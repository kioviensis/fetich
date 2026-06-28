import type {
  HttpMethod,
  RetryContext,
  RetryEvent,
  RetryOptions,
} from '../../types'

type RetryPolicy = {
  maxRetries: number
  retryDelay: number
  backoffFactor: number
  retryStatusCodes: number[]
  retryNetworkErrors: boolean
  maxRetryDelay: number
  retryMethods: readonly HttpMethod[]
  retryUnsafeMethods: boolean
  jitter: NonNullable<RetryOptions['jitter']>
  respectRetryAfter: boolean
  shouldRetry?: RetryOptions['shouldRetry']
  onRetry?: RetryOptions['onRetry']
}

type HeaderReader = {
  get(name: string): string | null
}

type HttpErrorLike = Error & {
  status: number
  response: {
    headers: HeaderReader
  }
}

type HttpErrorCandidate = Error & {
  status?: unknown
  response?: {
    headers?: unknown
  }
}

const DEFAULT_RETRY_POLICY: Omit<RetryPolicy, 'shouldRetry' | 'onRetry'> = {
  maxRetries: 3,
  retryDelay: 300,
  backoffFactor: 2,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
  retryNetworkErrors: true,
  maxRetryDelay: 30_000,
  retryMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'],
  retryUnsafeMethods: false,
  jitter: 'none',
  respectRetryAfter: true,
}

function shouldUseRetryPolicy(
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

export function createRetryPolicy(
  clientRetry?: RetryOptions | boolean,
  requestRetry?: RetryOptions | boolean
): RetryPolicy | undefined {
  if (!shouldUseRetryPolicy(clientRetry, requestRetry)) {
    return undefined
  }

  const clientRetryOptions =
    typeof clientRetry === 'object' ? clientRetry : undefined
  const baseRetryOptions = {
    ...DEFAULT_RETRY_POLICY,
    ...clientRetryOptions,
  }

  if (requestRetry === true) {
    return baseRetryOptions
  }

  if (typeof requestRetry === 'object') {
    return {
      ...baseRetryOptions,
      ...requestRetry,
    }
  }

  return baseRetryOptions
}

export async function shouldRetry(
  error: Error,
  retryCount: number,
  retryConfig: RetryPolicy | undefined,
  context: Pick<RetryContext, 'bodyReplayable' | 'method' | 'url'>
): Promise<boolean> {
  if (!retryConfig) return false

  const retryContext: RetryContext = {
    ...context,
    error,
    retryCount,
  }

  if (retryConfig.shouldRetry) {
    return await retryConfig.shouldRetry(error, retryCount, retryContext)
  }

  if (
    !context.bodyReplayable ||
    !isRetryMethodAllowed(context.method, retryConfig)
  ) {
    return false
  }

  if (isHttpError(error)) {
    return retryConfig.retryStatusCodes.includes(error.status)
  }

  if (
    isNetworkError(error) ||
    (error.name === 'TypeError' && !isInvalidUrlError(error))
  ) {
    return retryConfig.retryNetworkErrors
  }

  return false
}

export function calculateRetryDelay(
  attempt: number,
  retryConfig: RetryPolicy | undefined,
  error: Error
): number {
  if (!retryConfig) return 0

  const retryAfterDelay = retryConfig.respectRetryAfter
    ? getRetryAfterDelay(error)
    : undefined

  if (retryAfterDelay !== undefined) {
    return Math.min(retryAfterDelay, retryConfig.maxRetryDelay)
  }

  const delay =
    retryConfig.retryDelay * Math.pow(retryConfig.backoffFactor, attempt)

  return applyJitter(
    Math.min(delay, retryConfig.maxRetryDelay),
    retryConfig.jitter,
    attempt
  )
}

export async function notifyRetry(
  retryConfig: RetryPolicy | undefined,
  event: RetryEvent
): Promise<void> {
  await retryConfig?.onRetry?.(event)
}

function isRetryMethodAllowed(
  method: HttpMethod,
  retryConfig: RetryPolicy
): boolean {
  if (retryConfig.retryUnsafeMethods) {
    return true
  }

  const normalizedMethod = method.toUpperCase()
  return retryConfig.retryMethods.some(
    retryMethod => retryMethod.toUpperCase() === normalizedMethod
  )
}

function getRetryAfterDelay(error: Error): number | undefined {
  if (!isHttpError(error)) {
    return undefined
  }

  const retryAfter = error.response.headers.get('retry-after')
  if (!retryAfter) {
    return undefined
  }

  const retryAfterSeconds = Number(retryAfter)
  if (Number.isFinite(retryAfterSeconds)) {
    return Math.max(0, retryAfterSeconds * 1000)
  }

  const retryAfterDate = Date.parse(retryAfter)
  if (Number.isNaN(retryAfterDate)) {
    return undefined
  }

  return Math.max(0, retryAfterDate - Date.now())
}

function applyJitter(
  delay: number,
  jitter: RetryPolicy['jitter'],
  attempt: number
): number {
  if (typeof jitter === 'function') {
    return Math.max(0, jitter(delay, attempt))
  }

  if (jitter === 'full') {
    return Math.floor(Math.random() * delay)
  }

  if (jitter === 'equal') {
    return Math.floor(delay / 2 + Math.random() * (delay / 2))
  }

  return delay
}

function isInvalidUrlError(error: Error): boolean {
  return (
    error.message.includes('Invalid URL') ||
    error.message.includes('Failed to parse URL')
  )
}

function isHttpError(error: Error): error is HttpErrorLike {
  const candidate = error as HttpErrorCandidate

  return (
    error.name === 'HttpError' &&
    typeof candidate.status === 'number' &&
    isHeaderReader(candidate.response?.headers)
  )
}

function isNetworkError(error: Error): boolean {
  return error.name === 'NetworkError'
}

function isHeaderReader(value: unknown): value is HeaderReader {
  const candidate = value as { get?: unknown }

  return (
    candidate !== null &&
    typeof candidate === 'object' &&
    typeof candidate.get === 'function'
  )
}
