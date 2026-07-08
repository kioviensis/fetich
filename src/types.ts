import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { AssertSupportedPath, RequirePathParams } from './utils'

export type RetryJitter =
  'none' | 'full' | 'equal' | ((delay: number, retryCount: number) => number)

export interface RetryContext {
  /** The error that may trigger a retry */
  error: Error
  /** Zero-based retry count for the failed attempt */
  retryCount: number
  /** HTTP method used for the request */
  method: HttpMethod
  /** Final request URL after base URL, path params, middleware, and query params */
  url: string
  /** Whether the serialized request body can be sent again safely */
  bodyReplayable: boolean
}

export interface RetryEvent extends RetryContext {
  /** One-based attempt number that will run after the delay */
  nextAttempt: number
  /** Delay before the next attempt in milliseconds */
  delay: number
}

export interface RetryOptions {
  /** Maximum number of retry attempts when retries are enabled (default: 3) */
  maxRetries?: number
  /** Base delay between retries in milliseconds when retries are enabled (default: 300) */
  retryDelay?: number
  /** Exponential backoff factor (default: 2) */
  backoffFactor?: number
  /** Status codes that should trigger a retry when retries are enabled (default: [408, 429, 500, 502, 503, 504]) */
  retryStatusCodes?: number[]
  /** Whether to retry on network errors when retries are enabled (default: true) */
  retryNetworkErrors?: boolean
  /** Maximum retry delay in milliseconds when retries are enabled (default: 30_000) */
  maxRetryDelay?: number
  /** Methods eligible for built-in retries when retries are enabled (default: idempotent methods) */
  retryMethods?: readonly HttpMethod[]
  /** Allows the built-in retry policy to retry methods outside retryMethods (default: false) */
  retryUnsafeMethods?: boolean
  /** Applies jitter to calculated exponential backoff delays (default: 'none') */
  jitter?: RetryJitter
  /** Whether to honor Retry-After response headers on HTTP errors (default: true) */
  respectRetryAfter?: boolean
  /** Called before waiting for the next retry attempt */
  onRetry?: (event: RetryEvent) => void | Promise<void>
  /** Custom function to determine if a request should be retried */
  shouldRetry?: (
    error: Error,
    retryCount: number,
    context: RetryContext
  ) => boolean | Promise<boolean>
}

export type FetchOptions = Omit<
  RequestInit,
  'body' | 'headers' | 'signal' | 'method'
> & {
  /** Node/undici and future Fetch extensions can be passed through here */
  [option: string]: unknown
}

export type EnforcedPathParamsOptions<
  TBody = unknown,
  TParams extends RequestParamsType = RequestParamsType,
  Path extends string = string,
> = RequirePathParams<
  AssertSupportedPath<Path>,
  string extends Path
    ? Omit<RequestOptions<TBody>, 'params'> & {
        params?: TParams
      }
    : Omit<RequestOptions<TBody>, 'params' | 'pathParams'> & {
        params?: TParams
      }
>

export interface RequestOptions<TBody = unknown> {
  headers?: HttpHeaders
  params?: RequestParamsType
  pathParams?: Record<string, string | number | undefined>
  body?: TBody
  timeout?: number
  signal?: AbortSignal
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData'
  cache?: RequestCache
  credentials?: RequestCredentials
  mode?: RequestMode
  redirect?: RequestRedirect
  fetchOptions?: FetchOptions
  retry?: RetryOptions | boolean
}

export interface HttpRequestOptions<
  TBody = unknown,
  TParams extends RequestParamsType = RequestParamsType,
> extends Omit<RequestOptions<TBody>, 'params'> {
  method?: HttpMethod
  /** Query parameters */
  params?: TParams
}

export interface RequestDefaults {
  headers?: HttpHeaders
  params?: RequestParamsType
  timeout?: number
  credentials?: RequestCredentials
  cache?: RequestCache
  mode?: RequestMode
  redirect?: RequestRedirect
  fetchOptions?: FetchOptions
  responseType?: HttpRequestOptions['responseType']
  retry?: RetryOptions | boolean
}

export interface RequestDefaultsContext<
  TBody = unknown,
  TParams extends RequestParamsType = RequestParamsType,
  Path extends string = string,
> {
  /** Raw path or URL passed by the caller before path parameter generation */
  path: Path
  /** Path after template parameter generation, before baseUrl and query params */
  resolvedPath: string
  method: HttpMethod
  params?: TParams
  pathParams?: Record<string, string | number | undefined>
  body?: TBody
  hasBody: boolean
  requestOptions: Readonly<HttpRequestOptions<TBody, TParams>>
  baseUrl: string
  headers: HttpHeaders
  timeout: number
  retry?: RetryOptions | boolean
}

export interface ResponseType<T = unknown> {
  data: T
  status: number
  statusText: string
  headers: HttpHeaders
  method: HttpMethod
  url: string
  raw: Response
}

export type ExtractableResponse<T> = Promise<ResponseType<T>> & {
  data(): Promise<T>
  void(): Promise<void>
}

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

export type SuccessContractStatus = `${2 | 3}${Digit}${Digit}`
export type ErrorContractStatus = `${4 | 5}${Digit}${Digit}`
export type ContractStatus = SuccessContractStatus | ErrorContractStatus

export type ContractStatusMap<Status extends string = ContractStatus> = {
  default?: Schema
} & Partial<Record<Status, Schema>>

export type SuccessContractStatusMap = ContractStatusMap<SuccessContractStatus>

export type ErrorContractStatusMap = ContractStatusMap<ErrorContractStatus>

export type ResponseContractBranch<Status extends string = ContractStatus> =
  Schema | ContractStatusMap<Status>

export type ResponseContract =
  | Schema
  | {
      success: ResponseContractBranch<SuccessContractStatus>
      error?: ResponseContractBranch<ErrorContractStatus>
    }

type InferContractBranchSchema<Branch> = Branch extends Schema
  ? Branch
  : Branch extends object
    ? Extract<Branch[keyof Branch], Schema>
    : never

export type InferContractBranchOutput<Branch> = InferSchemaOutput<
  InferContractBranchSchema<Branch>
>

export type InferContractSuccess<Contract> = Contract extends Schema
  ? InferSchemaOutput<Contract>
  : Contract extends { success: infer Success }
    ? InferContractBranchOutput<Success>
    : unknown

export type InferContractError<Contract> = Contract extends {
  error: infer ErrorBranch
}
  ? InferContractBranchOutput<ErrorBranch>
  : unknown

export type ContractableResponse<T> = ExtractableResponse<T> & {
  contract<C extends ResponseContract>(
    contract: C
  ): ExtractableResponse<InferContractSuccess<C>>
}

/**
 * Request context that can be modified by onRequest hook
 */
export interface RequestContext<TBody = unknown> {
  /** The URL to send the request to */
  url: string
  /** The HTTP method (GET, POST, etc.) */
  method: HttpMethod
  /** Query parameters to append to the URL */
  params?: RequestParamsType
  /** Headers to send with the request */
  headers: Headers
  /** Request body */
  body?: TBody
  /** AbortSignal for request cancellation */
  signal?: AbortSignal
  /** Fetch options */
  fetchOptions: FetchOptions
}

// Extended RequestInit type to include duplex for ReadableStream request bodies
export interface ExtendedRequestInit extends RequestInit {
  duplex?: 'half'
}

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS'
  | (string & {})

export type HttpHeaders = Record<string, string>

export type RequestParamsType = Record<
  string,
  | string
  | number
  | boolean
  | Date
  | (string | number | boolean | undefined | null)[]
  | readonly Date[]
  | undefined
  | null
>

export type Schema<T = unknown> =
  | StandardSchemaV1<unknown, T>
  | (StandardSchemaV1<unknown, T> & { _output: T })
  | (StandardSchemaV1<unknown, T> & { _output?: T })

export type InferSchemaOutput<ResponseSchema> = ResponseSchema extends unknown
  ? ResponseSchema extends { parse: infer ParseFn }
    ? ParseFn extends (...args: infer _Args) => infer Output
      ? Awaited<Output>
      : unknown
    : ResponseSchema extends { _output: infer Output }
      ? Output
      : ResponseSchema extends { _output?: infer Output }
        ? Output
        : ResponseSchema extends StandardSchemaV1
          ? StandardSchemaV1.InferOutput<ResponseSchema>
          : unknown
  : never

export type SerializeBody<TBody = unknown> = (
  body: TBody
) => BodyInit | null | undefined

export type SerializeParams = (params: RequestParamsType) => string

export type CustomFetch = typeof fetch
