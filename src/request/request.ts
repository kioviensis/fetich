import { processResponse } from '../response'
import { isReplayableBody } from './serialization'
import {
  createCombinedSignal,
  createPreAbortedRequestError,
  normalizeExecutionError,
  sleep,
} from './abort'
import { createHttpError, fetchWithNetworkError } from './fetchErrors'
import { applyResponseMiddleware } from './middleware'
import type {
  CustomFetch,
  ExtendedRequestInit,
  HttpMethod,
  RequestOptions,
  ResponseType,
  RetryOptions,
} from '../types'

interface ExecuteHttpRequestWithRetryOptions {
  fetchImplementation: CustomFetch
  requestInit: ExtendedRequestInit
  requestRetry?: RetryOptions | boolean
  clientRetry?: RetryOptions | boolean
  url: string
  method: HttpMethod
  timeout: number
  signal?: AbortSignal
  responseType?: RequestOptions['responseType']
  onResponseMiddleware?: (
    response: ResponseType<unknown>
  ) => ResponseType<unknown> | Promise<ResponseType<unknown>>
  isExpectedStatus: (status: number) => boolean
}

export async function executeHttpRequestWithRetry<TResponse>({
  fetchImplementation,
  requestInit: baseRequestInit,
  requestRetry,
  clientRetry,
  url,
  method,
  timeout,
  signal,
  responseType,
  onResponseMiddleware,
  isExpectedStatus,
}: ExecuteHttpRequestWithRetryOptions): Promise<ResponseType<TResponse>> {
  const retryHelpers = shouldLoadRetryPolicy(clientRetry, requestRetry)
    ? await import('./retry')
    : undefined
  const mergedRetryOptions = retryHelpers?.createRetryPolicy(
    clientRetry,
    requestRetry
  )
  const maxRetries = mergedRetryOptions?.maxRetries ?? 0
  const bodyReplayable = isReplayableBody(baseRequestInit.body)
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController()
    let didTimeout = false
    const timeoutId = setTimeout(() => {
      didTimeout = true
      controller.abort()
    }, timeout)

    const { signal: finalSignal, cleanup: cleanupSignal } =
      createCombinedSignal(signal, controller.signal)
    let attemptCleanedUp = false
    const cleanupAttempt = () => {
      if (attemptCleanedUp) {
        return
      }

      attemptCleanedUp = true
      clearTimeout(timeoutId)
      cleanupSignal()
    }

    try {
      if (finalSignal?.aborted) {
        throw createPreAbortedRequestError(finalSignal.reason)
      }

      const requestInit: ExtendedRequestInit = {
        ...baseRequestInit,
        signal: finalSignal,
      }

      const response = await fetchWithNetworkError(
        fetchImplementation,
        url,
        requestInit
      )

      const responseData = await processResponse<TResponse>(response, {
        responseType,
        method,
        url,
        tolerateParseError: !isExpectedStatus(response.status),
      })

      const finalResponse = await applyResponseMiddleware({
        onResponseMiddleware,
        response: responseData,
        url,
        method,
      })

      if (!isExpectedStatus(finalResponse.status)) {
        throw createHttpError(finalResponse, responseData.parseError)
      }

      return finalResponse
    } catch (error) {
      lastError = normalizeExecutionError(error, {
        didTimeout,
        finalSignal,
        timeout,
      })

      if (
        attempt >= maxRetries ||
        !retryHelpers ||
        !(await retryHelpers.shouldRetry(
          lastError,
          attempt,
          mergedRetryOptions,
          {
            bodyReplayable,
            method,
            url,
          }
        ))
      ) {
        throw lastError
      }

      const delay = retryHelpers.calculateRetryDelay(
        attempt,
        mergedRetryOptions,
        lastError
      )
      await retryHelpers.notifyRetry(mergedRetryOptions, {
        bodyReplayable,
        delay,
        error: lastError,
        method,
        nextAttempt: attempt + 1,
        retryCount: attempt,
        url,
      })
      cleanupAttempt()
      await sleep(delay, signal)
    } finally {
      cleanupAttempt()
    }
  }

  throw new Error('Retry loop terminated unexpectedly')
}

function shouldLoadRetryPolicy(
  clientRetry?: RetryOptions | boolean,
  requestRetry?: RetryOptions | boolean
): boolean {
  return (
    requestRetry !== false &&
    (clientRetry === true ||
      typeof clientRetry === 'object' ||
      requestRetry === true ||
      typeof requestRetry === 'object')
  )
}
