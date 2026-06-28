import { MiddlewareError } from './errors'
import type { SchemaValidator } from './schema'
import type {
  CustomFetch,
  ExtendedRequestInit,
  FetchOptions,
  HttpHeaders,
  HttpMethod,
  RequestContext,
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
  mergeFetchOptions,
  sanitizeFetchOptions,
  serializeQueryParams,
  serializeRequestBody,
} from './request/serialization'
import {
  appendQueryString,
  assertRequestUrlSupported,
  constructUrl,
} from './request/url'
import { executeHttpRequestWithRetry } from './request/request'
import { createErrorMessage, createStandardizedError } from './errors/handling'

export interface HttpRequestOptions<
  TBody = unknown,
  TParams extends RequestParamsType = RequestParamsType,
> {
  method?: HttpMethod
  headers?: HttpHeaders
  /** Query parameters */
  params?: TParams
  /** Path parameters for URL template */
  pathParams?: Record<string, string | number | undefined>
  /** Request body */
  body?: TBody
  timeout?: number
  signal?: AbortSignal
  /** Fetch options */
  credentials?: RequestCredentials
  cache?: RequestCache
  mode?: RequestMode
  redirect?: RequestRedirect
  /** Additional Fetch/Node options passed through to the underlying fetch call */
  fetchOptions?: FetchOptions
  /** Response type override */
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData'
  /** Per-request retry configuration */
  retry?: RetryOptions | boolean
}

type InternalHttpRequestOptions<
  TBody = unknown,
  TParams extends RequestParamsType = RequestParamsType,
> = HttpRequestOptions<TBody, TParams> & {
  [successStatusValidator]?: (status: number) => boolean
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

    let dynamicDefaults: RequestDefaults | void | undefined
    if (defaults) {
      dynamicDefaults = await defaults({
        path: url,
        resolvedPath,
        method,
        params: options.params,
        pathParams,
        body: options.body,
        hasBody: options.body !== undefined,
        requestOptions: cloneRequestOptions(options),
        baseUrl,
        headers: { ...defaultHeaders },
        timeout: defaultTimeout,
        retry: config.retry,
      })
    }

    const resolvedUrl = baseUrl
      ? constructUrl(baseUrl, resolvedPath)
      : resolvedPath

    const requestFetchOptions = mergeRequestFetchOptions(
      dynamicDefaults,
      options
    )
    const mergedHeaders = new Headers(defaultHeaders)
    applyHeaders(mergedHeaders, dynamicDefaults?.headers)
    applyHeaders(mergedHeaders, options.headers)

    const params = mergeParams(dynamicDefaults?.params, options.params)
    const timeout =
      options.timeout ?? dynamicDefaults?.timeout ?? defaultTimeout
    const requestRetry = options.retry ?? dynamicDefaults?.retry
    const responseType = options.responseType ?? dynamicDefaults?.responseType

    const baseRequestContext: RequestContext<TBody> = {
      url: resolvedUrl,
      method,
      params,
      headers: mergedHeaders,
      body: options.body,
      signal: options.signal,
      fetchOptions: requestFetchOptions,
    }

    let requestContext: RequestContext<TBody> = baseRequestContext

    if (onRequestMiddleware) {
      try {
        // prevent middleware from mutating the original context
        const contextCopy: RequestContext<TBody> = {
          ...baseRequestContext,
          headers: new Headers(baseRequestContext.headers),
          fetchOptions: { ...baseRequestContext.fetchOptions },
        }

        const middlewareResult = await onRequestMiddleware(contextCopy)

        if (middlewareResult === undefined) {
          requestContext = contextCopy
        } else if (!isRequestContextLike(middlewareResult)) {
          throw new MiddlewareError(
            'Request middleware must return a valid RequestContext object',
            'request',
            requestContext.url,
            requestContext.method
          )
        } else {
          requestContext = middlewareResult
        }
      } catch (error) {
        if (error instanceof MiddlewareError) {
          throw error
        }

        throw new MiddlewareError(
          createErrorMessage('Request middleware failed', error),
          'request',
          requestContext.url,
          requestContext.method,
          createStandardizedError(error, 'Request middleware')
        )
      }
    }

    if (requestContext.params) {
      const serializedParams = customSerializeParams
        ? customSerializeParams(requestContext.params)
        : serializeQueryParams(requestContext.params)

      if (serializedParams) {
        requestContext.url = appendQueryString(
          requestContext.url,
          serializedParams
        )
      }
    }

    assertRequestUrlSupported(requestContext.url, usesNativeFetch)

    const baseRequestInit: ExtendedRequestInit = {
      ...sanitizeFetchOptions(requestContext.fetchOptions),
      method: requestContext.method,
      headers: requestContext.headers,
    }

    if (
      requestContext.body !== undefined &&
      requestContext.method !== 'GET' &&
      requestContext.method !== 'HEAD'
    ) {
      let body: BodyInit
      let contentType: string | undefined

      if (customSerializeBody) {
        const serializedBody = customSerializeBody(requestContext.body)
        if (serializedBody == null) {
          body = ''
        } else {
          body = serializedBody
        }
      } else {
        const serialized = serializeRequestBody(requestContext.body)
        body = serialized.body
        contentType = serialized.contentType
      }

      baseRequestInit.body = body

      if (contentType && !requestContext.headers.has('content-type')) {
        requestContext.headers.set('content-type', contentType)
      }

      baseRequestInit.duplex = 'half'
    }

    return executeHttpRequestWithRetry<TResponse>({
      fetchImplementation: customFetch ?? globalThis.fetch,
      requestInit: baseRequestInit,
      clientRetry: config.retry,
      requestRetry,
      url: requestContext.url,
      method: requestContext.method,
      timeout,
      signal: requestContext.signal,
      responseType,
      onResponseMiddleware,
      isExpectedStatus: customSuccessStatusValidator ?? isSuccessfulStatus,
    })
  }
}

function cloneRequestOptions<TBody, TParams extends RequestParamsType>(
  options: HttpRequestOptions<TBody, TParams>
): Readonly<HttpRequestOptions<TBody, TParams>> {
  return {
    ...options,
    headers: options.headers ? { ...options.headers } : undefined,
    params: options.params ? { ...options.params } : undefined,
    pathParams: options.pathParams ? { ...options.pathParams } : undefined,
    fetchOptions: options.fetchOptions
      ? { ...options.fetchOptions }
      : undefined,
  }
}

function applyHeaders(headers: Headers, values: HttpHeaders | undefined): void {
  if (!values) {
    return
  }

  for (const [name, value] of Object.entries(values)) {
    headers.set(name, value)
  }
}

function mergeParams<TParams extends RequestParamsType>(
  defaults: RequestParamsType | undefined,
  params: TParams | undefined
): RequestParamsType | undefined {
  if (!defaults) {
    return params
  }

  if (!params) {
    return defaults
  }

  return {
    ...defaults,
    ...params,
  }
}

function mergeRequestFetchOptions<TBody, TParams extends RequestParamsType>(
  defaults: RequestDefaults | void | undefined,
  options: HttpRequestOptions<TBody, TParams>
): FetchOptions {
  const defaultFetchOptions = mergeFetchOptions(defaults?.fetchOptions, {
    cache: defaults?.cache,
    credentials: defaults?.credentials,
    mode: defaults?.mode,
    redirect: defaults?.redirect,
  })
  const requestFetchOptions = mergeFetchOptions(options.fetchOptions, {
    cache: options.cache,
    credentials: options.credentials,
    mode: options.mode,
    redirect: options.redirect,
  })

  return {
    ...defaultFetchOptions,
    ...requestFetchOptions,
  }
}

function isRequestContextLike(
  value: unknown
): value is RequestContext<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'url' in value &&
    typeof value.url === 'string' &&
    'method' in value &&
    typeof value.method === 'string' &&
    'headers' in value &&
    value.headers instanceof Headers &&
    'fetchOptions' in value &&
    typeof value.fetchOptions === 'object' &&
    value.fetchOptions !== null
  )
}
