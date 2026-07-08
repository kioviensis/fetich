import {
  ContractValidationError,
  HttpError,
  InvalidContractError,
  InvalidSchemaError,
  SchemaValidationError,
} from '../errors'
import type { SchemaValidator } from '../schema'
import { isSuccessfulStatus, successStatusValidator } from '../status'
import type {
  InferContractSuccess,
  InferSchemaOutput,
  HttpRequestOptions,
  RequestParamsType,
  ResponseContract,
  ResponseContractBranch,
  ResponseType,
  Schema,
} from '../types'

export function validateResponseContractShape(
  contract: ResponseContract
): void {
  if (isSchemaLike(contract)) {
    return
  }

  if (!isObjectRecord(contract)) {
    throw new InvalidContractError(
      'Response contract must be a schema or an object with a success branch',
      contract
    )
  }

  if (!('success' in contract)) {
    throw new InvalidContractError(
      'Response contract object must include a success branch',
      contract,
      undefined,
      'success'
    )
  }

  validateResponseContractBranch(contract.success, contract, 'success')

  if ('error' in contract && contract.error !== undefined) {
    validateResponseContractBranch(contract.error, contract, 'error')
  }
}

export function createContractRequestOptions<
  TBody,
  TParams extends RequestParamsType,
>(
  options: HttpRequestOptions<TBody, TParams>,
  contract: ResponseContract
): HttpRequestOptions<TBody, TParams> {
  if (!isContractObject(contract) || isSchemaLike(contract.success)) {
    return options
  }

  const successMap = contract.success

  if (
    !Object.keys(successMap).some(
      key => key !== 'default' && Number.isInteger(Number(key))
    )
  ) {
    return options
  }

  return {
    ...options,
    [successStatusValidator]: (status: number) =>
      isSuccessfulStatus(status) || Object.hasOwn(successMap, status),
  } as HttpRequestOptions<TBody, TParams>
}

export async function validateResponsePromiseWithContract<
  C extends ResponseContract,
>(
  contract: C,
  responsePromise: Promise<ResponseType<unknown>>,
  schemaValidator: SchemaValidator
): Promise<ResponseType<InferContractSuccess<C>>> {
  try {
    const response = await responsePromise
    const schema = resolveSuccessSchema(contract, response.status, true)!
    return await validateResponseData(contract, schema, response, 'success', {
      schemaValidator,
    })
  } catch (error) {
    if (!(error instanceof HttpError)) {
      throw error
    }

    return await validateHttpError(contract, error, schemaValidator)
  }
}

function validateResponseContractBranch(
  branch: unknown,
  contract: ResponseContract,
  branchName: 'success' | 'error'
): void {
  if (isSchemaLike(branch)) {
    return
  }

  if (isObjectRecord(branch)) {
    for (const key of Object.keys(branch)) {
      assertStatusMapKey(key, contract, branchName)
    }

    return
  }

  throw new InvalidContractError(
    `${
      branchName === 'success' ? 'Success' : 'Error'
    } response contract branch must be a schema or status map`,
    contract,
    undefined,
    branchName
  )
}

async function validateHttpError<C extends ResponseContract>(
  contract: C,
  error: HttpError,
  schemaValidator: SchemaValidator
): Promise<ResponseType<InferContractSuccess<C>>> {
  const failedResponse = createResponseFromHttpError(error)
  const successSchema = resolveSuccessSchema(contract, error.status, false)

  if (successSchema) {
    return await validateResponseData(
      contract,
      successSchema,
      failedResponse,
      'success',
      { schemaValidator }
    )
  }

  const errorSchema = resolveErrorSchema(contract, error.status)

  if (!errorSchema) {
    throw error
  }

  const validatedErrorData = await validateResponseContract(
    errorSchema,
    failedResponse,
    'error',
    schemaValidator
  )

  throw new HttpError(
    `HTTP ${error.status} ${error.statusText}`,
    error.status,
    error.statusText,
    validatedErrorData,
    error.response,
    error.url,
    error.method,
    error.cause
  )
}

async function validateResponseData<
  C extends ResponseContract,
  S extends Schema,
>(
  _contract: C,
  schema: S,
  response: ResponseType<unknown>,
  branch: 'success' | 'error',
  options: { schemaValidator: SchemaValidator }
): Promise<ResponseType<InferContractSuccess<C>>> {
  const validatedData = await validateResponseContract(
    schema,
    response,
    branch,
    options.schemaValidator
  )

  return {
    ...response,
    data: validatedData,
  } as ResponseType<InferContractSuccess<C>>
}

function resolveSuccessSchema(
  contract: ResponseContract,
  status: number,
  includeDefault: boolean
): Schema | undefined {
  if (!isContractObject(contract)) {
    return includeDefault ? contract : undefined
  }

  const schema = resolveBranchSchema(contract.success, status, includeDefault)

  if (!schema && includeDefault) {
    throw new InvalidContractError(
      `No success response contract found for status ${status}`,
      contract,
      status,
      'success'
    )
  }

  return schema
}

function resolveErrorSchema(
  contract: ResponseContract,
  status: number
): Schema | undefined {
  if (!isContractObject(contract) || !contract.error) {
    return undefined
  }

  return resolveBranchSchema(contract.error, status, true)
}

function resolveBranchSchema(
  branch: ResponseContractBranch,
  status: number,
  includeDefault: boolean
): Schema | undefined {
  if (isSchemaLike(branch)) {
    return includeDefault ? branch : undefined
  }

  const statusMap = branch as Record<string, Schema | undefined>
  return (
    statusMap[String(status)] ??
    (includeDefault ? statusMap.default : undefined)
  )
}

async function validateResponseContract<S extends Schema>(
  schema: S,
  response: ResponseType<unknown>,
  branch: 'success' | 'error',
  schemaValidator: SchemaValidator
): Promise<InferSchemaOutput<S>> {
  try {
    return (await schemaValidator.validate(
      schema,
      response.data
    )) as InferSchemaOutput<S>
  } catch (error) {
    if (error instanceof InvalidSchemaError) {
      throw error
    }

    const branchLabel = branch === 'success' ? 'Success' : 'Error'
    const details = error instanceof Error ? `: ${error.message}` : ''

    throw new ContractValidationError(
      `${branchLabel} response failed contract validation${details}`,
      schema,
      response.data,
      response,
      branch,
      error instanceof Error ? error : undefined,
      error instanceof SchemaValidationError ? error.issues : undefined
    )
  }
}

function createResponseFromHttpError(error: HttpError): ResponseType<unknown> {
  return {
    data: error.data,
    status: error.status,
    statusText: error.statusText,
    headers: Object.fromEntries(error.response.headers.entries()),
    method: error.method,
    url: error.url,
    raw: error.response,
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSchemaLike(value: unknown): value is Schema {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    '~standard' in value
  )
}

function isContractObject(
  value: ResponseContract
): value is Exclude<ResponseContract, Schema> {
  return isObjectRecord(value) && !isSchemaLike(value)
}

function assertStatusMapKey(
  key: string,
  contract: ResponseContract,
  branchName: 'success' | 'error'
): void {
  if (key === 'default') {
    return
  }

  const status = Number(key)

  if (!Number.isInteger(status) || status < 100 || status >= 600) {
    throw new InvalidContractError(
      'Response contract status map keys must be HTTP status codes or "default"',
      contract,
      undefined,
      branchName
    )
  }

  if (branchName === 'success' && (status < 200 || status >= 400)) {
    throw new InvalidContractError(
      'Success response contract status keys must be 2xx or 3xx status codes',
      contract,
      status,
      branchName
    )
  }

  if (branchName === 'error' && (status < 400 || status >= 600)) {
    throw new InvalidContractError(
      'Error response contract status keys must be 4xx or 5xx status codes',
      contract,
      status,
      branchName
    )
  }
}
