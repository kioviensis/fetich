import type { StandardSchemaV1 } from '@standard-schema/spec'

interface HttpClientError {
  name: string
  message: string
  cause?: Error
  stack?: string
}

function formatErrorData(data: unknown): string {
  if (data === null || data === undefined || data === '') {
    return 'No response data'
  }

  let dataString: string

  try {
    dataString = typeof data === 'string' ? data : JSON.stringify(data)
  } catch {
    dataString = String(data)
  }

  return dataString.length > 500
    ? dataString.substring(0, 500) + '...'
    : dataString
}

export class HttpError<TErrorData = unknown>
  extends Error
  implements HttpClientError
{
  public readonly name = 'HttpError'
  public readonly status: number
  public readonly statusText: string
  public readonly data: TErrorData
  public readonly response: Response
  public readonly url: string
  public readonly method: string
  public override readonly cause?: Error

  constructor(
    message: string,
    status: number,
    statusText: string,
    data: TErrorData,
    response: Response,
    url: string,
    method: string,
    cause?: Error
  ) {
    const statusCategory =
      status >= 500
        ? 'Server Error'
        : status >= 400
          ? 'Client Error'
          : status >= 300
            ? 'Redirect'
            : 'Success'

    const enhancedMessage = `HTTP ${statusCategory} (${status}): ${message}
Request: ${method} ${url}
Data: ${formatErrorData(data)}`

    super(enhancedMessage, { cause })
    this.status = status
    this.statusText = statusText
    this.data = data
    this.response = response
    this.url = url
    this.method = method
    this.cause = cause
  }
}

export class NetworkError extends Error implements HttpClientError {
  public readonly name = 'NetworkError'
  public override readonly cause?: Error

  constructor(message: string, cause?: Error) {
    super(message, { cause })
    this.cause = cause
  }
}

export class SchemaValidationError extends Error implements HttpClientError {
  public readonly name: string = 'SchemaValidationError'
  public readonly schema: unknown
  public readonly data: unknown
  public readonly issues?: ReadonlyArray<StandardSchemaV1.Issue>
  public override readonly cause?: Error

  constructor(
    message: string,
    schema: unknown,
    data: unknown,
    cause?: Error,
    issues?: ReadonlyArray<StandardSchemaV1.Issue>
  ) {
    super(message, { cause })
    this.schema = schema
    this.data = data
    this.issues = issues
    this.cause = cause
  }
}

export class ContractValidationError extends SchemaValidationError {
  public override readonly name = 'ContractValidationError'
  public readonly branch: 'success' | 'error'
  public readonly status: number
  public readonly statusText: string
  public readonly response: Response
  public readonly url: string
  public readonly method: string

  constructor(
    message: string,
    schema: unknown,
    data: unknown,
    response: {
      status: number
      statusText: string
      raw: Response
      url: string
      method: string
    },
    branch: 'success' | 'error',
    cause?: Error,
    issues?: ReadonlyArray<StandardSchemaV1.Issue>
  ) {
    super(
      `${message}
Request: ${response.method} ${response.url}
Status: ${response.status} ${response.statusText}`,
      schema,
      data,
      cause,
      issues
    )
    this.branch = branch
    this.status = response.status
    this.statusText = response.statusText
    this.response = response.raw
    this.url = response.url
    this.method = response.method
  }
}

export class InvalidContractError extends Error implements HttpClientError {
  public readonly name = 'InvalidContractError'
  public readonly contract: unknown
  public readonly status?: number
  public readonly branch?: 'success' | 'error'
  public override readonly cause?: Error

  constructor(
    message: string,
    contract: unknown,
    status?: number,
    branch?: 'success' | 'error',
    cause?: Error
  ) {
    super(message, { cause })
    this.contract = contract
    this.status = status
    this.branch = branch
    this.cause = cause
  }
}

export class TimeoutError extends Error implements HttpClientError {
  public readonly name = 'TimeoutError'
  public override readonly cause?: Error

  constructor(message: string, cause?: Error) {
    super(message, { cause })
    this.cause = cause
  }
}

/**
 * Thrown when a request is cancelled by a caller-provided AbortSignal.
 *
 * Timeouts are reported as TimeoutError; this class represents explicit
 * cancellation only.
 */
export class AbortError extends Error implements HttpClientError {
  public readonly name = 'AbortError'
  public override readonly cause?: Error

  constructor(message = 'The operation was aborted', cause?: Error) {
    super(message, { cause })
    this.cause = cause
  }
}

export class PathParameterError extends Error implements HttpClientError {
  public readonly name = 'PathParameterError'
  public readonly url: string
  public readonly requiredParams: string[]
  public readonly providedParams: string[]
  public override readonly cause?: Error

  constructor(
    message: string,
    url: string,
    requiredParams: string[],
    providedParams: string[],
    cause?: Error
  ) {
    const enhancedMessage = `${message}
URL Template: ${url}
Expected: [${requiredParams
      .map(p => `"${p}"`)
      .join(', ')}], Actual: [${providedParams.map(p => `"${p}"`).join(', ')}]`

    super(enhancedMessage, { cause })
    this.url = url
    this.requiredParams = requiredParams
    this.providedParams = providedParams
    this.cause = cause
  }
}

export class MiddlewareError extends Error implements HttpClientError {
  public readonly name = 'MiddlewareError'
  public readonly type: 'request' | 'response'
  public readonly url?: string
  public readonly method?: string
  public override readonly cause?: Error

  constructor(
    message: string,
    type: 'request' | 'response',
    url?: string,
    method?: string,
    cause?: Error
  ) {
    const requestInfo = url ? `Request: ${method || 'UNKNOWN'} ${url}` : ''
    const enhancedMessage = requestInfo ? `${message}\n${requestInfo}` : message

    super(enhancedMessage, { cause })
    this.type = type
    this.url = url
    this.method = method
    this.cause = cause
  }
}

export class SerializationError extends Error implements HttpClientError {
  public readonly name = 'SerializationError'
  public override readonly cause?: Error

  constructor(message: string, cause?: Error) {
    super(message, { cause })
    this.cause = cause
  }
}

abstract class SchemaDefinitionError extends Error implements HttpClientError {
  public abstract readonly name: string
  public readonly schema: unknown
  public override readonly cause?: Error

  constructor(message: string, schema: unknown, cause?: Error) {
    super(message, { cause })
    this.schema = schema
    this.cause = cause
  }
}

export class InvalidSchemaError extends SchemaDefinitionError {
  public readonly name = 'InvalidSchemaError'
}

export class AsyncSchemaValidationError extends SchemaDefinitionError {
  public readonly name = 'AsyncSchemaValidationError'
}

export class InvalidBaseUrlError extends Error implements HttpClientError {
  public readonly name = 'InvalidBaseUrlError'
  public readonly baseUrl: string
  public override readonly cause?: Error

  constructor(message: string, baseUrl: string, cause?: Error) {
    const enhancedMessage = `${message}
Base URL: ${baseUrl}`

    super(enhancedMessage, { cause })
    this.baseUrl = baseUrl
    this.cause = cause
  }
}
