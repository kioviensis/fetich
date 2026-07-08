import type { SchemaValidator } from './schema'
import type {
  CustomFetch,
  HttpHeaders,
  HttpRequestOptions,
  RequestContext,
  RequestDefaults,
  RequestDefaultsContext,
  RequestParamsType,
  ResponseType,
  RetryOptions,
  SerializeBody,
  SerializeParams,
} from './types'
import {
  type AssertSupportedPath,
  generatePath,
  type PathParams,
} from './utils/path'
import { isSuccessfulStatus, successStatusValidator } from './status'
import {
  appendRequestQueryParams,
  createRequestInit,
  resolveRequestOptions,
} from './request/options'
import { assertRequestUrlSupported, constructUrl } from './request/url'
import { applyRequestMiddleware } from './request/middleware'
import { executeHttpRequestWithRetry } from './request/request'
import { resolveRequestDefaults } from './request/defaults'

export type {
  HttpRequestOptions,
  RequestDefaults,
  RequestDefaultsContext,
} from './types'

type InternalHttpRequestOptions<
  TBody = unknown,
  TParams extends RequestParamsType = RequestParamsType,
> = HttpRequestOptions<TBody, TParams> & {
  [successStatusValidator]?: (status: number) => boolean
}

export interface HttpClientConfig<TSerializedBody = unknown> {
  /** Base URL for all requests */
  baseUrl?: string
  /** Default headers */
  headers?: HttpHeaders
  /** Default timeout */
  timeout?: number
  /** Schema validator */
  schemaValidator?: SchemaValidator
  /** Default retry configuration */
  retry?: RetryOptions | boolean
  /** Custom fetch implementation */
  fetch?: CustomFetch
  /** Custom body serializer */
  serializeBody?: SerializeBody<TSerializedBody>
  /** Custom params serializer */
  serializeParams?: SerializeParams
  /** Per-request defaults resolved before request options and middleware */
  defaults?: <
    TBody extends TSerializedBody = TSerializedBody,
    TParams extends RequestParamsType = RequestParamsType,
    Path extends string = string,
  >(
    context: RequestDefaultsContext<TBody, TParams, Path>
  ) => RequestDefaults | void | Promise<RequestDefaults | void>
  /** Request middleware - can modify request before sending */
  onRequestMiddleware?: <TBody = unknown>(
    context: RequestContext<TBody>
  ) => RequestContext<TBody> | void | Promise<RequestContext<TBody> | void>
  /** Response middleware - can modify response after receiving */
  onResponseMiddleware?: (
    response: ResponseType<unknown>
  ) => ResponseType<unknown> | Promise<ResponseType<unknown>>
}

/**
 * Creates an HTTP request handler with the given configuration.
 * This is the core function that handles all HTTP requests with retry logic,
 * middleware, serialization, defaults, and timeouts.
 */
export function createHttpRequest<TSerializedBody = unknown>(
  config: HttpClientConfig<TSerializedBody> = {}
) {
  const {
    baseUrl = '',
    headers: defaultHeaders = {},
    timeout: defaultTimeout = 30_000,
    fetch: customFetch,
    serializeBody: customSerializeBody,
    serializeParams: customSerializeParams,
    defaults,
    onRequestMiddleware,
    onResponseMiddleware,
  } = config
  const usesNativeFetch = customFetch === undefined

  return async function fetcher<
    Path extends string = string,
    TResponse = unknown,
    TBody extends TSerializedBody = TSerializedBody,
    TParams extends RequestParamsType = RequestParamsType,
  >(
    url: Path,
    options: HttpRequestOptions<TBody, TParams> = {}
  ): Promise<ResponseType<TResponse>> {
    const method = options.method ?? 'GET'
    const pathParams = options.pathParams
    const customSuccessStatusValidator = (
      options as InternalHttpRequestOptions<TBody, TParams>
    )[successStatusValidator]

    const resolvedPath =
      pathParams === undefined
        ? generatePath(url as AssertSupportedPath<Path>)
        : generatePath(
            url as AssertSupportedPath<Path>,
            pathParams as PathParams<Path>
          )

    const dynamicDefaults = defaults
      ? await resolveRequestDefaults({
          path: url,
          resolvedPath,
          method,
          options,
          baseUrl,
          defaultHeaders,
          defaultTimeout,
          defaults,
          retry: config.retry,
        })
      : undefined

    const resolvedUrl = baseUrl
      ? constructUrl(baseUrl, resolvedPath)
      : resolvedPath

    const resolvedOptions = resolveRequestOptions({
      defaultHeaders,
      defaultTimeout,
      defaults: dynamicDefaults,
      options,
    })
    const baseRequestContext: RequestContext<TBody> = {
      url: resolvedUrl,
      method,
      params: resolvedOptions.params,
      headers: resolvedOptions.headers,
      body: options.body,
      signal: options.signal,
      fetchOptions: resolvedOptions.fetchOptions,
    }
    const requestContext = onRequestMiddleware
      ? await applyRequestMiddleware({
          context: baseRequestContext,
          onRequestMiddleware,
        })
      : baseRequestContext

    requestContext.url = appendRequestQueryParams(
      requestContext.url,
      requestContext.params,
      customSerializeParams
    )

    assertRequestUrlSupported(requestContext.url, usesNativeFetch)

    const requestInit = createRequestInit({
      context: requestContext,
      serializeBody: customSerializeBody,
    })

    return executeHttpRequestWithRetry<TResponse>({
      fetchImplementation: customFetch ?? globalThis.fetch,
      requestInit,
      clientRetry: config.retry,
      requestRetry: resolvedOptions.retry,
      url: requestContext.url,
      method: requestContext.method,
      timeout: resolvedOptions.timeout,
      signal: requestContext.signal,
      responseType: resolvedOptions.responseType,
      onResponseMiddleware,
      isExpectedStatus: customSuccessStatusValidator ?? isSuccessfulStatus,
    })
  }
}
