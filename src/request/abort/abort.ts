import { AbortError, TimeoutError } from '../../errors'
import { createStandardizedError } from '../../errors/handling'

export function normalizeExecutionError(
  error: unknown,
  {
    didTimeout,
    finalSignal,
    timeout,
  }: {
    didTimeout: boolean
    finalSignal?: AbortSignal
    timeout: number
  }
): Error {
  let lastError = createStandardizedError(error, 'Request execution')

  if (isAbortError(lastError) && didTimeout) {
    return new TimeoutError(`Request timeout after ${timeout}ms`, lastError)
  }

  if (isAbortError(lastError) || finalSignal?.aborted) {
    lastError =
      lastError instanceof AbortError
        ? lastError
        : new AbortError(lastError.message, lastError)
  }

  return lastError
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve()
  }

  if (signal?.aborted) {
    return Promise.reject(createAbortError(signal.reason))
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, ms)

    const handleAbort = () => {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', handleAbort)
      reject(createAbortError(signal?.reason))
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

export function createPreAbortedRequestError(reason: unknown): Error {
  if (reason instanceof Error && reason.name === 'AbortError') {
    return new AbortError('Request aborted by caller', reason)
  }

  return createAbortError(reason)
}

export function createCombinedSignal(
  requestSignal?: AbortSignal,
  timeoutSignal?: AbortSignal
): { signal?: AbortSignal; cleanup: () => void } {
  if (!requestSignal && !timeoutSignal) {
    return {
      signal: undefined,
      cleanup: () => undefined,
    }
  }

  if (!requestSignal) {
    return {
      signal: timeoutSignal,
      cleanup: () => undefined,
    }
  }

  if (!timeoutSignal) {
    return {
      signal: requestSignal,
      cleanup: () => undefined,
    }
  }

  if (requestSignal.aborted) {
    return {
      signal: requestSignal,
      cleanup: () => undefined,
    }
  }

  if (timeoutSignal.aborted) {
    return {
      signal: timeoutSignal,
      cleanup: () => undefined,
    }
  }

  const combinedController = new AbortController()

  const handleAbort = (event: Event) => {
    const sourceSignal = event.target

    if (sourceSignal instanceof AbortSignal) {
      combinedController.abort(sourceSignal.reason)
      return
    }

    combinedController.abort()
  }

  requestSignal.addEventListener('abort', handleAbort, { once: true })
  timeoutSignal.addEventListener('abort', handleAbort, { once: true })

  return {
    signal: combinedController.signal,
    cleanup: () => {
      requestSignal.removeEventListener('abort', handleAbort)
      timeoutSignal.removeEventListener('abort', handleAbort)
    },
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function createAbortError(reason: unknown): Error {
  if (reason instanceof AbortError) {
    return reason
  }

  if (reason instanceof Error) {
    return new AbortError(reason.message, reason)
  }

  return new AbortError()
}
