import { SerializationError } from './errors'
import type { HttpMethod, ResponseType } from './types'
import { createErrorMessage } from './errors/handling'

type ParsedResponse<T> = ResponseType<T> & {
  parseError?: SerializationError
}

export async function processResponse<T = unknown>(
  response: Response,
  options: {
    responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData'
    method: HttpMethod
    url: string
    tolerateParseError?: boolean
  }
): Promise<ParsedResponse<T>> {
  const headers = Object.fromEntries(response.headers.entries())

  let data: unknown
  let parseError: SerializationError | undefined

  if (hasNoResponseBody(response.status, options.method)) {
    return {
      data: undefined as T,
      status: response.status,
      statusText: response.statusText,
      headers,
      method: options.method,
      url: options.url,
      raw: response,
    }
  }

  const responseBody = response.clone()
  const finalType = options.responseType ?? detectResponseType(response)
  let fallbackText: string | undefined
  const fallbackBody =
    options.tolerateParseError === true &&
    (finalType === 'blob' ||
      finalType === 'arrayBuffer' ||
      finalType === 'formData')
      ? response.clone()
      : undefined

  try {
    if (finalType === 'json') {
      fallbackText = await responseBody.text()
      data = JSON.parse(fallbackText)
    } else if (finalType === 'text') {
      data = await responseBody.text()
    } else if (finalType === 'blob') {
      data = await responseBody.blob()
    } else if (finalType === 'arrayBuffer') {
      data = await responseBody.arrayBuffer()
    } else if (finalType === 'formData') {
      data = await responseBody.formData()
    } else {
      fallbackText = await responseBody.text()
      data = parseJsonOrText(fallbackText)
    }
  } catch (error) {
    parseError = new SerializationError(
      createErrorMessage('Failed to parse response body', error),
      error instanceof Error ? error : undefined
    )

    if (!options.tolerateParseError) {
      throw parseError
    }

    if (fallbackText !== undefined) {
      data = fallbackText
    } else if (fallbackBody) {
      try {
        data = await fallbackBody.text()
      } catch {
        data = ''
      }
    } else {
      data = ''
    }
  }

  return {
    data: data as T,
    status: response.status,
    statusText: response.statusText,
    headers,
    method: options.method,
    url: options.url,
    raw: response,
    parseError,
  }
}

function detectResponseType(
  response: Response
): 'json' | 'text' | 'arrayBuffer' | 'formData' | undefined {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const mimeType = contentType.split(';', 1)[0]?.trim() ?? ''

  if (isJsonMimeType(mimeType)) {
    return 'json'
  }

  if (mimeType.startsWith('text/')) {
    return 'text'
  }

  if (
    mimeType === 'application/octet-stream' ||
    mimeType === 'application/pdf' ||
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/')
  ) {
    return 'arrayBuffer'
  }

  if (
    mimeType === 'multipart/form-data' ||
    mimeType === 'application/x-www-form-urlencoded'
  ) {
    return 'formData'
  }

  return undefined
}

function parseJsonOrText(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function hasNoResponseBody(status: number, method: HttpMethod): boolean {
  return (
    method.toUpperCase() === 'HEAD' ||
    status === 204 ||
    status === 205 ||
    status === 304
  )
}

function isJsonMimeType(mimeType: string): boolean {
  return (
    mimeType === 'application/json' ||
    (mimeType.startsWith('application/') && mimeType.endsWith('+json'))
  )
}
