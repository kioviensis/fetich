import type { FetchOptions, RequestParamsType } from '../../types'

export function mergeFetchOptions(
  fetchOptions: FetchOptions | undefined,
  aliases: Pick<RequestInit, 'cache' | 'credentials' | 'mode' | 'redirect'>
): FetchOptions {
  const merged: FetchOptions = sanitizeFetchOptions(fetchOptions)

  if (aliases.cache !== undefined) {
    merged.cache = aliases.cache
  }

  if (aliases.credentials !== undefined) {
    merged.credentials = aliases.credentials
  }

  if (aliases.mode !== undefined) {
    merged.mode = aliases.mode
  }

  if (aliases.redirect !== undefined) {
    merged.redirect = aliases.redirect
  }

  return merged
}

export function sanitizeFetchOptions(
  fetchOptions: FetchOptions | undefined
): FetchOptions {
  const safeOptions: FetchOptions = { ...(fetchOptions ?? {}) }
  const optionsRecord = safeOptions as Record<string, unknown>

  delete optionsRecord.body
  delete optionsRecord.headers
  delete optionsRecord.method
  delete optionsRecord.signal

  return safeOptions
}

export function serializeQueryParams(params: RequestParamsType): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) {
          searchParams.append(key, serializeQueryValue(item))
        }
      }
    } else if (value !== undefined && value !== null) {
      searchParams.append(
        key,
        serializeQueryValue(value as string | number | boolean | Date)
      )
    }
  }

  return searchParams.toString()
}

export function serializeRequestBody(body: unknown): {
  body: BodyInit
  contentType?: string
} {
  if (ArrayBuffer.isView(body)) {
    const bytes = new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
    return { body: new Uint8Array(bytes).buffer }
  }

  if (
    typeof body === 'string' ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    body instanceof Blob ||
    body instanceof ReadableStream
  ) {
    return { body: body }
  }

  if (isObjectLike(body)) {
    return {
      body: JSON.stringify(body),
      contentType: 'application/json',
    }
  }

  if (body === null || body === undefined) {
    return { body: '' }
  }

  return { body: String(body) }
}

export function isReplayableBody(body: BodyInit | null | undefined): boolean {
  return !(body instanceof ReadableStream)
}

function serializeQueryValue(value: string | number | boolean | Date): string {
  return value instanceof Date ? value.toISOString() : String(value)
}

function isObjectLike(
  value: unknown
): value is Record<string, unknown> | unknown[] | { toJSON(): unknown } {
  return (
    value !== null &&
    typeof value === 'object' &&
    (Array.isArray(value) ||
      ('toJSON' in value && typeof value.toJSON === 'function') ||
      Object.prototype.toString.call(value) === '[object Object]')
  )
}
