import { expect, it, vi } from 'vitest'

import { createHttpClient } from '../client'
import { HttpError, MiddlewareError, SerializationError } from '../errors'

function createJsonFetchMock(data: unknown = { ok: true }) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  )
}

it('treats no-body success responses as empty data without parsing', async () => {
  const client = createHttpClient({
    fetch: (async () =>
      new Response(null, {
        status: 204,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch,
  })

  const response = await client.delete('https://api.example.com/users/1')

  expect(response.status).toBe(204)
  expect(response.data).toBeUndefined()
  expect(response.raw.bodyUsed).toBe(false)
})

it('treats HEAD responses as empty data even when content-type is JSON', async () => {
  const client = createHttpClient({
    fetch: (async () =>
      new Response(null, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch,
  })

  const response = await client.request('https://api.example.com/users/1', {
    method: 'HEAD',
  })

  expect(response.status).toBe(200)
  expect(response.data).toBeUndefined()
})

it('preserves an unconsumed raw response after parsing data', async () => {
  const client = createHttpClient({
    fetch: (async () =>
      new Response('plain response', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      })) as typeof fetch,
  })

  const response = await client.get('https://api.example.com/text', {
    responseType: 'text',
  })

  expect(response.data).toBe('plain response')
  expect(response.raw.bodyUsed).toBe(false)
  await expect(response.raw.text()).resolves.toBe('plain response')
})

it('preserves an unconsumed raw response after JSON parsing', async () => {
  const body = '{"ok":true}'
  const client = createHttpClient({
    fetch: (async () =>
      new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch,
  })

  const response = await client.get('https://api.example.com/json')

  expect(response.data).toEqual({ ok: true })
  expect(response.raw.bodyUsed).toBe(false)
  await expect(response.raw.text()).resolves.toBe(body)
})

it('falls back to text for unknown response content without consuming raw', async () => {
  const client = createHttpClient({
    fetch: (async () =>
      new Response('plain response', {
        status: 200,
      })) as typeof fetch,
  })

  const response = await client.get('https://api.example.com/unknown')

  expect(response.data).toBe('plain response')
  expect(response.raw.bodyUsed).toBe(false)
  await expect(response.raw.text()).resolves.toBe('plain response')
})

it('parses JSON-looking unknown response content as JSON', async () => {
  const body = new TextEncoder().encode('{"ok":true}')
  const client = createHttpClient({
    fetch: (async () => new Response(body)) as typeof fetch,
  })

  const response = await client.get('https://api.example.com/unknown-json')

  expect(response.data).toEqual({ ok: true })
})

it('detects binary response content as ArrayBuffer', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4])
  const client = createHttpClient({
    fetch: (async () =>
      new Response(bytes, {
        headers: { 'content-type': 'application/pdf' },
      })) as typeof fetch,
  })

  const response = await client.get('https://api.example.com/report')

  expect(response.data).toBeInstanceOf(ArrayBuffer)
  expect([...new Uint8Array(response.data as ArrayBuffer)]).toEqual([
    1, 2, 3, 4,
  ])
})

it('detects form response content as FormData', async () => {
  const formBody = new URLSearchParams({ name: 'Ada' })
  const client = createHttpClient({
    fetch: (async () =>
      new Response(formBody, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      })) as typeof fetch,
  })

  const response = await client.get('https://api.example.com/form')

  expect(response.data).toBeInstanceOf(FormData)
  expect((response.data as FormData).get('name')).toBe('Ada')
})

it('falls back to empty data when a failed binary response stream cannot be read', async () => {
  const brokenStream = new ReadableStream({
    pull(controller) {
      controller.error(new Error('stream boom'))
    },
  })
  const client = createHttpClient({
    fetch: (async () =>
      new Response(brokenStream, {
        status: 500,
        headers: { 'content-type': 'application/octet-stream' },
      })) as typeof fetch,
  })

  const error = await client
    .get('https://api.example.com/broken-binary')
    .catch((cause: unknown) => cause)

  expect(error).toBeInstanceOf(HttpError)
  expect(error).toMatchObject({
    data: '',
  })
  expect((error as HttpError).cause).toBeInstanceOf(SerializationError)
})

it('allows request middleware to return void and keep the current context', async () => {
  const fetchMock = createJsonFetchMock()
  const onRequestMiddleware = vi.fn(() => undefined)
  const client = createHttpClient({
    fetch: fetchMock as typeof fetch,
    onRequestMiddleware,
  })

  const response = await client.get('https://api.example.com/users')

  expect(response.data).toEqual({ ok: true })
  expect(onRequestMiddleware).toHaveBeenCalled()
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.example.com/users',
    expect.objectContaining({ method: 'GET' })
  )
})

it('classifies invalid request middleware returns as MiddlewareError', async () => {
  const client = createHttpClient({
    onRequestMiddleware: () => null as never,
  })

  await expect(client.get('https://api.example.com/users')).rejects.toThrow(
    MiddlewareError
  )
  await expect(client.get('https://api.example.com/users')).rejects.toThrow(
    'Request middleware must return a valid RequestContext object'
  )
})

it('does not double-wrap invalid request middleware returns', async () => {
  const client = createHttpClient({
    onRequestMiddleware: () => null as never,
  })

  const error = await client
    .get('https://api.example.com/users')
    .catch((cause: unknown) => cause)

  expect(error).toBeInstanceOf(MiddlewareError)
  expect((error as MiddlewareError).message).toContain(
    'Request middleware must return a valid RequestContext object'
  )
  expect((error as MiddlewareError).message).not.toContain(
    'Request middleware failed'
  )
  expect((error as MiddlewareError).cause).toBeUndefined()
  expect((error as MiddlewareError).type).toBe('request')
  expect((error as MiddlewareError).url).toBe('https://api.example.com/users')
  expect((error as MiddlewareError).method).toBe('GET')
})

it('wraps thrown request middleware errors with request context', async () => {
  const client = createHttpClient({
    onRequestMiddleware: () => {
      throw new Error('request boom')
    },
  })

  const error = await client
    .get('https://api.example.com/users')
    .catch((cause: unknown) => cause)

  expect(error).toBeInstanceOf(MiddlewareError)
  expect((error as MiddlewareError).message).toContain(
    'Request middleware failed: request boom'
  )
  expect((error as MiddlewareError).cause?.message).toBe('request boom')
  expect((error as MiddlewareError).type).toBe('request')
  expect((error as MiddlewareError).url).toBe('https://api.example.com/users')
  expect((error as MiddlewareError).method).toBe('GET')
})

it('does not double-wrap MiddlewareError thrown by request middleware', async () => {
  const middlewareError = new MiddlewareError('custom request error', 'request')
  const client = createHttpClient({
    onRequestMiddleware: () => {
      throw middlewareError
    },
  })

  const error = await client
    .get('https://api.example.com/users')
    .catch((cause: unknown) => cause)

  expect(error).toBe(middlewareError)
  expect((error as MiddlewareError).message).not.toContain(
    'Request middleware failed'
  )
})

it('lets request headers replace default headers case-insensitively', async () => {
  const fetchMock = createJsonFetchMock()
  const client = createHttpClient({
    fetch: fetchMock as typeof fetch,
    headers: { Authorization: 'Bearer default' },
  })

  await client.get('https://api.example.com/users', {
    headers: { authorization: 'Bearer request' },
  })

  const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit
  const headers = new Headers(requestInit.headers)
  expect(headers.get('authorization')).toBe('Bearer request')
  expect(headers.get('authorization')).not.toContain('Bearer default')
})

it('lets request content-type replace default content-type case-insensitively', async () => {
  const fetchMock = createJsonFetchMock()
  const client = createHttpClient({
    fetch: fetchMock as typeof fetch,
    headers: { 'Content-Type': 'application/json' },
  })

  await client.patch(
    'https://api.example.com/users/1',
    { name: 'Ada' },
    {
      headers: { 'content-type': 'application/merge-patch+json' },
    }
  )

  const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit
  const headers = new Headers(requestInit.headers)
  expect(headers.get('content-type')).toBe('application/merge-patch+json')
  expect(headers.get('content-type')).not.toContain('application/json,')
})

it('preserves explicit content-type when serializing object bodies', async () => {
  const fetchMock = createJsonFetchMock()
  const client = createHttpClient({ fetch: fetchMock as typeof fetch })

  await client.patch(
    'https://api.example.com/users/1',
    { name: 'Ada' },
    {
      headers: { 'content-type': 'application/merge-patch+json' },
    }
  )

  const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit
  expect(new Headers(requestInit.headers).get('content-type')).toBe(
    'application/merge-patch+json'
  )
})

it('does not let fetchOptions override reserved request fields', async () => {
  const poisonedSignal = new AbortController().signal
  const fetchMock = createJsonFetchMock()
  const client = createHttpClient({ fetch: fetchMock as typeof fetch })

  await client.get('https://api.example.com/users', {
    fetchOptions: {
      body: 'poisoned',
      headers: { 'x-poisoned': 'true' },
      keepalive: true,
      method: 'POST',
      signal: poisonedSignal,
    } as never,
  })

  const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit
  expect(requestInit.method).toBe('GET')
  expect(requestInit.body).toBeUndefined()
  expect(new Headers(requestInit.headers).has('x-poisoned')).toBe(false)
  expect(requestInit.signal).not.toBe(poisonedSignal)
  expect(requestInit.keepalive).toBe(true)
})

it('serializes Date query parameters as ISO strings', async () => {
  const fetchMock = createJsonFetchMock()
  const client = createHttpClient({ fetch: fetchMock as typeof fetch })
  const at = new Date('2026-05-22T12:34:56.789Z')

  await client.get('https://api.example.com/events', {
    params: { at },
  })

  const requestUrl = fetchMock.mock.calls[0]?.[0] as string
  expect(new URL(requestUrl).searchParams.get('at')).toBe(at.toISOString())
})

it('parses application/problem+json as strict JSON on successful responses', async () => {
  const client = createHttpClient({
    fetch: (async () =>
      new Response('not-json', {
        status: 200,
        headers: { 'content-type': 'application/problem+json' },
      })) as typeof fetch,
  })

  await expect(client.get('https://api.example.com/problem')).rejects.toThrow(
    SerializationError
  )
})

it('keeps malformed JSON error responses classified as HttpError with readable raw body', async () => {
  const client = createHttpClient({
    fetch: (async () =>
      new Response('not-json', {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch,
  })

  const error = await client
    .get('https://api.example.com/problem-error')
    .catch((cause: unknown) => cause)

  expect(error).toMatchObject({
    name: 'HttpError',
    data: 'not-json',
  })
  expect(error).toHaveProperty('cause')
  expect((error as { response: Response }).response.bodyUsed).toBe(false)
  await expect((error as { response: Response }).response.text()).resolves.toBe(
    'not-json'
  )
})
