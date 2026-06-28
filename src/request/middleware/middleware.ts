import { MiddlewareError } from '../../errors'
import type { HttpMethod, ResponseType } from '../../types'
import {
  createErrorMessage,
  createStandardizedError,
} from '../../errors/handling'

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
