import type { HttpClientConfig } from '../core'
import { createHttpRequest } from '../core'
import {
  createContractRequestOptions,
  validateResponseContractShape,
  validateResponsePromiseWithContract,
} from '../contract'
import { InvalidContractError } from '../errors'
import { validateAndNormalizeBaseUrl } from '../request/url'
import { createSchemaValidator } from '../schema'
import type { SchemaValidator } from '../schema'
import type {
  ContractableResponse,
  EnforcedPathParamsOptions,
  ExtractableResponse,
  HttpRequestOptions,
  InferContractSuccess,
  RequestParamsType,
  ResponseContract,
  ResponseType,
} from '../types'
import type {
  AssertSupportedPath,
  HasRequiredParams,
  RequirePathParams,
} from '../utils'

type PathOptionsArgs<Path extends string, TOptions> = [
  AssertSupportedPath<Path>,
] extends [never]
  ? [options: never]
  : HasRequiredParams<AssertSupportedPath<Path>> extends true
    ? [options: TOptions]
    : [options?: TOptions]

type EnforcedHttpRequestOptions<
  TBody,
  TParams extends RequestParamsType,
  Path extends string,
> = RequirePathParams<
  AssertSupportedPath<Path>,
  string extends Path
    ? HttpRequestOptions<TBody, TParams>
    : Omit<HttpRequestOptions<TBody, TParams>, 'pathParams'>
>

function createExtractableResponse<T>(
  promise: Promise<ResponseType<T>>
): ExtractableResponse<T> {
  const extractable = promise as ExtractableResponse<T>
  extractable.data = async () => (await promise).data
  extractable.void = async () => {
    await promise
  }
  return extractable
}

/**
 * Creates a chainable response that allows adding contract validation and extracting data
 */
function createContractableResponse<
  Path extends string,
  TResponse,
  TSerializedBody,
  TBody extends TSerializedBody,
  TParams extends RequestParamsType,
>(
  url: Path,
  options: HttpRequestOptions<TBody, TParams>,
  requestHandler: ReturnType<typeof createHttpRequest<TSerializedBody>>,
  schemaValidator: SchemaValidator
): ContractableResponse<TResponse> {
  let transportPromise: Promise<ResponseType<unknown>> | undefined
  let baseStartError: unknown

  const startTransport = (
    requestOptions: HttpRequestOptions<TBody, TParams>
  ) => {
    transportPromise ??= requestHandler<Path, unknown, TBody, TParams>(
      url,
      requestOptions
    )
    return transportPromise
  }

  const basePromise = new Promise<ResponseType<TResponse>>(
    (resolve, reject) => {
      queueMicrotask(() => {
        if (baseStartError !== undefined) {
          reject(baseStartError)
          return
        }

        startTransport(options).then(
          response => resolve(response as ResponseType<TResponse>),
          reject
        )
      })
    }
  )

  void basePromise.catch(() => undefined)

  const baseResponse = createExtractableResponse(
    basePromise
  ) as ContractableResponse<TResponse>

  baseResponse.contract = <C extends ResponseContract>(
    contract: C
  ): ExtractableResponse<InferContractSuccess<C>> => {
    try {
      validateResponseContractShape(contract)
      baseStartError = undefined

      if (transportPromise !== undefined) {
        throw new InvalidContractError(
          'Cannot attach a response contract after the request has started',
          contract
        )
      }

      const contractOptions = createContractRequestOptions(options, contract)
      const responsePromise = startTransport(contractOptions)

      return createExtractableResponse(
        validateResponsePromiseWithContract(
          contract,
          responsePromise,
          schemaValidator
        )
      )
    } catch (error) {
      if (transportPromise === undefined) {
        baseStartError = error
      }

      return createExtractableResponse(Promise.reject(error))
    }
  }

  return baseResponse
}

/**
 * Creates a complete HTTP client with method builders
 */
export function createHttpClient<TSerializedBody = unknown>(
  config: HttpClientConfig<TSerializedBody> = {}
) {
  const validatedConfig: HttpClientConfig<TSerializedBody> = {
    ...config,
    baseUrl: validateAndNormalizeBaseUrl(config.baseUrl),
  }

  const requestHandler = createHttpRequest<TSerializedBody>(validatedConfig)
  const schemaValidator = config.schemaValidator ?? createSchemaValidator()

  function get<
    Path extends string = string,
    TParams extends RequestParamsType = RequestParamsType,
  >(
    url: Path,
    ...args: PathOptionsArgs<
      Path,
      EnforcedPathParamsOptions<never, TParams, Path>
    >
  ) {
    return createContractableResponse<
      Path,
      unknown,
      TSerializedBody,
      never,
      TParams
    >(
      url,
      {
        ...(args[0] ?? {}),
        method: 'GET',
      },
      requestHandler,
      schemaValidator
    )
  }

  function createBodyMethod(method: 'POST' | 'PUT' | 'PATCH') {
    return <
      Path extends string = string,
      TBody extends TSerializedBody = TSerializedBody,
      TParams extends RequestParamsType = RequestParamsType,
    >(
      url: Path,
      body?: TBody,
      ...args: PathOptionsArgs<
        Path,
        EnforcedPathParamsOptions<TBody, TParams, Path>
      >
    ) =>
      createContractableResponse<
        Path,
        unknown,
        TSerializedBody,
        TBody,
        TParams
      >(
        url,
        {
          ...(args[0] ?? {}),
          method,
          body,
        },
        requestHandler,
        schemaValidator
      )
  }

  return {
    get,

    post: createBodyMethod('POST'),

    put: createBodyMethod('PUT'),

    patch: createBodyMethod('PATCH'),

    delete: <
      Path extends string = string,
      TParams extends RequestParamsType = RequestParamsType,
    >(
      url: Path,
      ...args: PathOptionsArgs<
        Path,
        EnforcedPathParamsOptions<never, TParams, Path>
      >
    ) =>
      createContractableResponse<
        Path,
        unknown,
        TSerializedBody,
        never,
        TParams
      >(
        url,
        {
          ...(args[0] ?? {}),
          method: 'DELETE',
        },
        requestHandler,
        schemaValidator
      ),

    /**
     * Generic request method for custom HTTP methods and full control
     */
    request: <
      Path extends string = string,
      TBody extends TSerializedBody = TSerializedBody,
      TParams extends RequestParamsType = RequestParamsType,
    >(
      url: Path,
      ...args: PathOptionsArgs<
        Path,
        EnforcedHttpRequestOptions<TBody, TParams, Path>
      >
    ) =>
      createContractableResponse<
        Path,
        unknown,
        TSerializedBody,
        TBody,
        TParams
      >(url, args[0] ?? {}, requestHandler, schemaValidator),
  }
}

export type HttpClient = ReturnType<typeof createHttpClient>
