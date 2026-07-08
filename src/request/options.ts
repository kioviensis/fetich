import type {
  ExtendedRequestInit,
  FetchOptions,
  HttpHeaders,
  HttpRequestOptions,
  RequestContext,
  RequestDefaults,
  RequestParamsType,
  RetryOptions,
  SerializeBody,
  SerializeParams,
} from '../types'
import {
  mergeFetchOptions,
  sanitizeFetchOptions,
  serializeQueryParams,
  serializeRequestBody,
} from './serialization'
import { appendQueryString } from './url'

type ResponseBodyType = HttpRequestOptions['responseType']

export interface ResolvedRequestOptions {
  headers: Headers
  params?: RequestParamsType
  fetchOptions: FetchOptions
  timeout: number
  retry?: RetryOptions | boolean
  responseType?: ResponseBodyType
}

export function cloneRequestOptions<TBody, TParams extends RequestParamsType>(
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

export function resolveRequestOptions<
  TBody,
  TParams extends RequestParamsType,
>({
  defaultHeaders,
  defaultTimeout,
  defaults,
  options,
}: {
  defaultHeaders: HttpHeaders
  defaultTimeout: number
  defaults: RequestDefaults | void | undefined
  options: HttpRequestOptions<TBody, TParams>
}): ResolvedRequestOptions {
  return {
    headers: createRequestHeaders(
      defaultHeaders,
      defaults?.headers,
      options.headers
    ),
    params: mergeRequestParams(defaults?.params, options.params),
    fetchOptions: mergeRequestFetchOptions(defaults, options),
    timeout: options.timeout ?? defaults?.timeout ?? defaultTimeout,
    retry: options.retry ?? defaults?.retry,
    responseType: options.responseType ?? defaults?.responseType,
  }
}

export function appendRequestQueryParams(
  url: string,
  params: RequestParamsType | undefined,
  serializeParams: SerializeParams | undefined
): string {
  if (!params) {
    return url
  }

  const queryString = serializeParams
    ? serializeParams(params)
    : serializeQueryParams(params)

  return queryString ? appendQueryString(url, queryString) : url
}

export function createRequestInit<TBody>({
  context,
  serializeBody,
}: {
  context: RequestContext<TBody>
  serializeBody?: SerializeBody<TBody>
}): ExtendedRequestInit {
  const requestInit: ExtendedRequestInit = {
    ...sanitizeFetchOptions(context.fetchOptions),
    method: context.method,
    headers: context.headers,
  }

  if (
    context.body === undefined ||
    context.method === 'GET' ||
    context.method === 'HEAD'
  ) {
    return requestInit
  }

  const serializedBody = serializeHttpRequestBody(context.body, serializeBody)
  requestInit.body = serializedBody.body

  if (serializedBody.contentType && !context.headers.has('content-type')) {
    context.headers.set('content-type', serializedBody.contentType)
  }

  requestInit.duplex = 'half'

  return requestInit
}

function createRequestHeaders(
  defaultHeaders: HttpHeaders,
  defaultOverrideHeaders: HttpHeaders | undefined,
  requestHeaders: HttpHeaders | undefined
): Headers {
  const headers = new Headers(defaultHeaders)
  applyHeaders(headers, defaultOverrideHeaders)
  applyHeaders(headers, requestHeaders)
  return headers
}

function applyHeaders(headers: Headers, values: HttpHeaders | undefined): void {
  if (!values) {
    return
  }

  for (const [name, value] of Object.entries(values)) {
    headers.set(name, value)
  }
}

function mergeRequestParams<TParams extends RequestParamsType>(
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

function serializeHttpRequestBody<TBody>(
  body: TBody,
  serializeBody: SerializeBody<TBody> | undefined
): { body: BodyInit; contentType?: string } {
  if (!serializeBody) {
    return serializeRequestBody(body)
  }

  const serializedBody = serializeBody(body)

  return {
    body: serializedBody == null ? '' : serializedBody,
  }
}
