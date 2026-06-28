import { HttpError, NetworkError } from '../../errors'
import type { CustomFetch, ResponseType } from '../../types'
import { createStandardizedError } from '../../errors/handling'
import { isAbortError } from '../abort'

export async function fetchWithNetworkError(
  fetchImplementation: CustomFetch,
  url: string,
  requestInit: RequestInit
): Promise<Response> {
  try {
    return await fetchImplementation(url, requestInit)
  } catch (error) {
    const standardizedError = createStandardizedError(
      error,
      'Network request failed'
    )

    if (
      isAbortError(standardizedError) ||
      standardizedError instanceof NetworkError
    ) {
      throw standardizedError
    }

    throw new NetworkError(standardizedError.message, standardizedError)
  }
}

export function createHttpError(
  response: ResponseType<unknown>,
  cause?: Error
): HttpError {
  return new HttpError(
    `HTTP ${response.status} ${response.statusText}`,
    response.status,
    response.statusText,
    response.data,
    response.raw,
    response.url,
    response.method,
    cause
  )
}
