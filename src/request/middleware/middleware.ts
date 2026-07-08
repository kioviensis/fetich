import { MiddlewareError } from '../../errors'
import type { HttpMethod, RequestContext, ResponseType } from '../../types'
import {
  createErrorMessage,
  createStandardizedError,
} from '../../errors/handling'

type RequestMiddleware = <TRequestBody = unknown>(
  context: RequestContext<TRequestBody>
) =>
  | RequestContext<TRequestBody>
  | void
  | Promise<RequestContext<TRequestBody> | void>

export async function applyRequestMiddleware<TBody>({
  context,
  onRequestMiddleware,
}: {
  context: RequestContext<TBody>
  onRequestMiddleware: RequestMiddleware
}): Promise<RequestContext<TBody>> {
  try {
    const middlewareContext = cloneRequestContext(context)
    const middlewareResult = await onRequestMiddleware(middlewareContext)

    if (middlewareResult === undefined) {
      return middlewareContext
    }

    if (!isRequestContextLike(middlewareResult)) {
      throw new MiddlewareError(
        'Request middleware must return a valid RequestContext object',
        'request',
        context.url,
        context.method
      )
    }

    return middlewareResult as RequestContext<TBody>
  } catch (error) {
    if (error instanceof MiddlewareError) {
      throw error
    }

    throw new MiddlewareError(
      createErrorMessage('Request middleware failed', error),
      'request',
      context.url,
      context.method,
      createStandardizedError(error, 'Request middleware')
    )
  }
}

export async function applyResponseMiddleware<TResponse>({
  onResponseMiddleware,
  response,
  url,
  method,
}: {
  onResponseMiddleware?: (
    response: ResponseType<unknown>
  ) => ResponseType<unknown> | Promise<ResponseType<unknown>>
  response: ResponseType<TResponse>
  url: string
  method: HttpMethod
}): Promise<ResponseType<TResponse>> {
  if (!onResponseMiddleware) {
    return response
  }

  try {
    const middlewareResult = await onResponseMiddleware(response)
    if (!isResponseTypeLike(middlewareResult)) {
      throw new MiddlewareError(
        'Response middleware must return a valid ResponseType object',
        'response',
        url,
        method
      )
    }

    return middlewareResult as ResponseType<TResponse>
  } catch (error) {
    if (error instanceof MiddlewareError) {
      throw error
    }

    throw new MiddlewareError(
      createErrorMessage('Response middleware failed', error),
      'response',
      url,
      method,
      createStandardizedError(error, 'Response middleware')
    )
  }
}

function cloneRequestContext<TBody>(
  context: RequestContext<TBody>
): RequestContext<TBody> {
  return {
    ...context,
    params: context.params ? { ...context.params } : undefined,
    headers: new Headers(context.headers),
    fetchOptions: { ...context.fetchOptions },
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

function isResponseTypeLike(value: unknown): value is ResponseType<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'data' in value &&
    'status' in value &&
    typeof value.status === 'number' &&
    'statusText' in value &&
    typeof value.statusText === 'string' &&
    'headers' in value &&
    typeof value.headers === 'object' &&
    value.headers !== null &&
    'method' in value &&
    typeof value.method === 'string' &&
    'url' in value &&
    typeof value.url === 'string' &&
    'raw' in value &&
    value.raw instanceof Response
  )
}
