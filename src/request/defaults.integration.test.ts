import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { createHttpClient } from '../client'
import type { RequestDefaultsContext } from '../core'
import { TimeoutError } from '../errors'
import { server } from '../testing/setup'

describe('dynamic request defaults', () => {
  it('evaluates defaults for each request so auth tokens can refresh', async () => {
    let token = 'first-token'
    const seenTokens: string[] = []

    server.use(
      http.get('https://api.example.com/me', ({ request }) => {
        seenTokens.push(request.headers.get('authorization') ?? '')
        return HttpResponse.json({ ok: true })
      })
    )

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      defaults: async () => ({
        headers: { authorization: `Bearer ${token}` },
      }),
    })

    await api.get('/me')
    token = 'second-token'
    await api.get('/me')

    expect(seenTokens).toEqual(['Bearer first-token', 'Bearer second-token'])
  })

  it('can choose a timeout from the request route', async () => {
    vi.useFakeTimers()

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      timeout: 1_000,
      defaults: ({ resolvedPath }) =>
        resolvedPath === '/slow' ? { timeout: 10 } : undefined,
      fetch: (async (_url, init) => {
        return await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              reject(
                Object.assign(new Error('aborted'), {
                  name: 'AbortError',
                })
              )
            },
            { once: true }
          )
        })
      }) as typeof fetch,
    })

    try {
      const request = api.get('/slow')
      await vi.advanceTimersByTimeAsync(10)

      await expect(request).rejects.toThrow(TimeoutError)
    } finally {
      vi.useRealTimers()
    }
  })

  it('passes request and static client context to defaults', async () => {
    const body = { name: 'Ada' }
    let capturedContext: RequestDefaultsContext | undefined
    const defaults = vi.fn((context: RequestDefaultsContext) => {
      capturedContext = context

      return {
        headers: { 'x-default': 'yes' },
      }
    })

    server.use(
      http.post('https://api.example.com/users/123', () => {
        return HttpResponse.json({ ok: true })
      })
    )

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      headers: { 'x-client': 'client' },
      timeout: 5_000,
      retry: false,
      defaults,
    })

    await api.post('/users/:id', body, {
      pathParams: { id: 123 },
      params: { include: 'profile' },
      headers: { 'x-request': 'request' },
      timeout: 2_500,
    })

    expect(defaults).toHaveBeenCalledTimes(1)

    if (!capturedContext) {
      throw new Error('defaults context was not captured')
    }

    const context = capturedContext
    expect(context.path).toBe('/users/:id')
    expect(context.resolvedPath).toBe('/users/123')
    expect(context.method).toBe('POST')
    expect(context.params).toEqual({ include: 'profile' })
    expect(context.pathParams).toEqual({ id: 123 })
    expect(context.body).toBe(body)
    expect(context.hasBody).toBe(true)
    expect(context.baseUrl).toBe('https://api.example.com')
    expect(context.headers).toEqual({ 'x-client': 'client' })
    expect(context.timeout).toBe(5_000)
    expect(context.retry).toBe(false)
    expect(context.requestOptions).toMatchObject({
      method: 'POST',
      params: { include: 'profile' },
      pathParams: { id: 123 },
      headers: { 'x-request': 'request' },
      timeout: 2_500,
      body,
    })
  })

  it('merges default params and headers before request options', async () => {
    server.use(
      http.get('https://api.example.com/merge', ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('fromDefault')).toBe('yes')
        expect(url.searchParams.get('fromRequest')).toBe('yes')
        expect(url.searchParams.get('shared')).toBe('request')
        expect(request.headers.get('x-default')).toBe('yes')
        expect(request.headers.get('x-request')).toBe('yes')
        expect(request.headers.get('x-shared')).toBe('request')
        return HttpResponse.json({ ok: true })
      })
    )

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      headers: { 'x-static': 'yes' },
      defaults: () => ({
        headers: {
          'x-default': 'yes',
          'x-shared': 'default',
        },
        params: {
          fromDefault: 'yes',
          shared: 'default',
        },
      }),
    })

    await api.get('/merge', {
      headers: {
        'x-request': 'yes',
        'x-shared': 'request',
      },
      params: {
        fromRequest: 'yes',
        shared: 'request',
      },
    })
  })

  it('lets request options override dynamic defaults', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('plain text', {
        headers: { 'content-type': 'text/plain' },
      })
    }) as unknown as typeof fetch

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetch: fetchMock,
      defaults: () => ({
        headers: { 'x-source': 'defaults' },
        responseType: 'json',
        cache: 'force-cache',
        fetchOptions: {
          keepalive: false,
          redirect: 'error',
        },
      }),
    })

    const response = await api.get('/override', {
      headers: { 'x-source': 'request' },
      responseType: 'text',
      cache: 'no-store',
      fetchOptions: { keepalive: true },
    })

    expect(response.data).toBe('plain text')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/override',
      expect.objectContaining({
        cache: 'no-store',
        keepalive: true,
        redirect: 'error',
      })
    )

    const init = vi.mocked(fetchMock).mock.calls[0][1]
    expect(init?.headers).toBeInstanceOf(Headers)
    expect((init?.headers as Headers).get('x-source')).toBe('request')
  })

  it('runs request middleware after dynamic defaults', async () => {
    const middleware = vi.fn(context => {
      expect(context.headers.get('x-default')).toBe('yes')
      expect(context.params).toEqual({ fromDefault: 'yes' })
      context.headers.set('x-middleware', 'yes')
      context.params = {
        ...context.params,
        fromMiddleware: 'yes',
      }
      return context
    })

    server.use(
      http.get('https://api.example.com/middleware', ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('fromDefault')).toBe('yes')
        expect(url.searchParams.get('fromMiddleware')).toBe('yes')
        expect(request.headers.get('x-default')).toBe('yes')
        expect(request.headers.get('x-middleware')).toBe('yes')
        return HttpResponse.json({ ok: true })
      })
    )

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      defaults: () => ({
        headers: { 'x-default': 'yes' },
        params: { fromDefault: 'yes' },
      }),
      onRequestMiddleware: middleware,
    })

    await api.get('/middleware')

    expect(middleware).toHaveBeenCalledTimes(1)
  })
})
