import type {
  HttpHeaders,
  HttpMethod,
  HttpRequestOptions,
  RequestDefaults,
  RequestDefaultsContext,
  RequestParamsType,
} from '../types'
import { cloneRequestOptions } from './options'

type RequestDefaultsResolver<
  TBody,
  TParams extends RequestParamsType = RequestParamsType,
  Path extends string = string,
> = (
  context: RequestDefaultsContext<TBody, TParams, Path>
) => RequestDefaults | void | Promise<RequestDefaults | void>

export function resolveRequestDefaults<
  TSerializedBody,
  TBody extends TSerializedBody,
  TParams extends RequestParamsType,
  Path extends string,
>({
  baseUrl,
  defaultHeaders,
  defaultTimeout,
  defaults,
  method,
  options,
  path,
  resolvedPath,
  retry,
}: {
  baseUrl: string
  defaultHeaders: HttpHeaders
  defaultTimeout: number
  defaults: RequestDefaultsResolver<TBody, TParams, Path>
  method: HttpMethod
  options: HttpRequestOptions<TBody, TParams>
  path: Path
  resolvedPath: string
  retry?: RequestDefaults['retry']
}): RequestDefaults | void | Promise<RequestDefaults | void> {
  return defaults({
    path,
    resolvedPath,
    method,
    params: options.params,
    pathParams: options.pathParams,
    body: options.body,
    hasBody: options.body !== undefined,
    requestOptions: cloneRequestOptions(options),
    baseUrl,
    headers: { ...defaultHeaders },
    timeout: defaultTimeout,
    retry,
  })
}
