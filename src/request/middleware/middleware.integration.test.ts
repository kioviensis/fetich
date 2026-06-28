import { http, HttpResponse } from 'msw'
import { expect, it, vi } from 'vitest'

import { createHttpClient } from '../../client'
import { InvalidBaseUrlError, MiddlewareError } from '../../errors'
import { server } from '../../testing/setup'

it('should handle middleware that changes URL path', async () => {
  const middleware = vi.fn(context => {
    return {
      ...context,
      url: context.url.replace('/api/v1', '/api/v2'),
    }
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onRequestMiddleware: middleware,
  })

  server.use(
    http.get('https://api.example.com/api/v2/users', () => {
      return HttpResponse.json({ users: [] })
    })
  )

  const response = await clientWithMiddleware.get('/api/v1/users', {
    params: { page: 1, limit: 10 },
  })

  expect(middleware).toHaveBeenCalledWith(
    expect.objectContaining({
      url: 'https://api.example.com/api/v1/users',
    })
  )

  expect(response.url).toBe(
    'https://api.example.com/api/v2/users?page=1&limit=10'
  )
  expect(response.status).toBe(200)
})

it('should handle middleware that adds query parameters to URL', async () => {
  const middleware = vi.fn(context => {
    return {
      ...context,
      url: context.url + '?debug=true',
    }
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onRequestMiddleware: middleware,
  })

  server.use(
    http.get('https://api.example.com/users', ({ request }) => {
      const url = new URL(request.url)
      // The debug param should be there, and additional params should be added
      expect(url.searchParams.has('debug')).toBe(true)
      expect(url.searchParams.get('page')).toBe('1')
      expect(url.searchParams.get('limit')).toBe('10')
      return HttpResponse.json({ users: [] })
    })
  )

  const response = await clientWithMiddleware.get('/users', {
    params: { page: 1, limit: 10 },
  })

  expect(response.url).toBe(
    'https://api.example.com/users?debug=true&page=1&limit=10'
  )
  expect(response.status).toBe(200)
})

it('should handle middleware that changes domain', async () => {
  const middleware = vi.fn(context => {
    return {
      ...context,
      url: context.url.replace(
        'https://api.example.com',
        'https://backup-api.example.com'
      ),
    }
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onRequestMiddleware: middleware,
  })

  server.use(
    http.get('https://backup-api.example.com/users', ({ request }) => {
      const url = new URL(request.url)
      expect(url.searchParams.get('page')).toBe('1')
      expect(url.searchParams.get('limit')).toBe('10')
      return HttpResponse.json({ users: [] })
    })
  )

  const response = await clientWithMiddleware.get('/users', {
    params: { page: 1, limit: 10 },
  })

  expect(response.url).toBe(
    'https://backup-api.example.com/users?page=1&limit=10'
  )
  expect(response.status).toBe(200)
})

it('should handle middleware that completely replaces URL', async () => {
  const middleware = vi.fn(context => {
    return {
      ...context,
      url: 'https://different-api.com/users',
    }
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onRequestMiddleware: middleware,
  })

  server.use(
    http.get('https://different-api.com/users', ({ request }) => {
      const url = new URL(request.url)
      expect(url.searchParams.get('page')).toBe('1')
      expect(url.searchParams.get('limit')).toBe('10')
      return HttpResponse.json({ users: [] })
    })
  )

  const response = await clientWithMiddleware.get('/users', {
    params: { page: 1, limit: 10 },
  })

  expect(response.url).toBe('https://different-api.com/users?page=1&limit=10')
  expect(response.status).toBe(200)
})

it('should handle middleware that modifies URL with existing query params', async () => {
  const middleware = vi.fn(context => {
    // Properly add query param using URL object to avoid malformed URLs
    const url = new URL(context.url)
    url.searchParams.set('debug', 'true')
    return {
      ...context,
      url: url.toString(),
    }
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onRequestMiddleware: middleware,
  })

  server.use(
    http.get('https://api.example.com/users', ({ request }) => {
      const url = new URL(request.url)
      expect(url.searchParams.get('debug')).toBe('true')
      expect(url.searchParams.get('page')).toBe('1')
      expect(url.searchParams.get('limit')).toBe('10')
      return HttpResponse.json({ users: [] })
    })
  )

  const response = await clientWithMiddleware.get('/users', {
    params: { page: 1, limit: 10 },
  })

  expect(response.url).toBe(
    'https://api.example.com/users?debug=true&page=1&limit=10'
  )
  expect(response.status).toBe(200)
})

it('should handle middleware that removes query params from URL', async () => {
  const middleware = vi.fn(context => {
    const url = new URL(context.url)
    url.search = ''
    return {
      ...context,
      url: url.toString(),
    }
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onRequestMiddleware: middleware,
  })

  server.use(
    http.get('https://api.example.com/users', ({ request }) => {
      const url = new URL(request.url)
      // Middleware removed existing params, but new params should still be added
      expect(url.searchParams.get('page')).toBe('1')
      expect(url.searchParams.get('limit')).toBe('10')
      return HttpResponse.json({ users: [] })
    })
  )

  const response = await clientWithMiddleware.get('/users?existing=param', {
    params: { page: 1, limit: 10 },
  })

  expect(response.url).toBe('https://api.example.com/users?page=1&limit=10')
  expect(response.status).toBe(200)
})

it('should handle middleware that changes URL multiple times', async () => {
  const middleware1 = vi.fn(context => {
    return {
      ...context,
      url: context.url.replace('/api/v1', '/api/v2'),
    }
  })

  const middleware2 = vi.fn(context => {
    const url = new URL(context.url)
    url.searchParams.set('debug', 'true')
    return {
      ...context,
      url: url.toString(),
    }
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onRequestMiddleware: async context => {
      const result1 = await middleware1(context)
      return middleware2(result1)
    },
  })

  server.use(
    http.get('https://api.example.com/api/v2/users', ({ request }) => {
      const url = new URL(request.url)
      expect(url.searchParams.has('debug')).toBe(true)
      expect(url.searchParams.get('page')).toBe('1')
      return HttpResponse.json({ users: [] })
    })
  )

  const response = await clientWithMiddleware.get('/api/v1/users', {
    params: { page: 1 },
  })

  expect(response.url).toBe(
    'https://api.example.com/api/v2/users?debug=true&page=1'
  )
  expect(response.status).toBe(200)
})

it('should handle middleware that makes URL invalid', async () => {
  const middleware = vi.fn(context => {
    return {
      ...context,
      url: 'not-a-valid-url',
    }
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onRequestMiddleware: middleware,
  })

  await expect(
    clientWithMiddleware.get('/users', {
      params: { page: 1 },
    })
  ).rejects.toThrow(InvalidBaseUrlError)
})

it('should handle middleware that returns same URL', async () => {
  const middleware = vi.fn(context => {
    return context // No change
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onRequestMiddleware: middleware,
  })

  server.use(
    http.get('https://api.example.com/users', ({ request }) => {
      const url = new URL(request.url)
      expect(url.searchParams.get('page')).toBe('1')
      return HttpResponse.json({ users: [] })
    })
  )

  const response = await clientWithMiddleware.get('/users', {
    params: { page: 1 },
  })

  expect(response.url).toBe('https://api.example.com/users?page=1')
  expect(response.status).toBe(200)
})

it('should handle response middleware that returns undefined', async () => {
  const onResponseMiddleware = vi.fn(() => {
    return undefined as any // Invalid return - should trigger validation error
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onResponseMiddleware,
  })

  server.use(
    http.get('https://api.example.com/users', () => {
      return HttpResponse.json({ users: [] })
    })
  )

  await expect(clientWithMiddleware.get('/users')).rejects.toThrow(
    MiddlewareError
  )

  await expect(clientWithMiddleware.get('/users')).rejects.toThrow(
    'Response middleware must return a valid ResponseType object'
  )
})

it('should not double-wrap invalid response middleware returns', async () => {
  const onResponseMiddleware = vi.fn(() => undefined as never)

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onResponseMiddleware,
  })

  server.use(
    http.get('https://api.example.com/users', () => {
      return HttpResponse.json({ users: [] })
    })
  )

  const error = await clientWithMiddleware
    .get('/users')
    .catch((cause: unknown) => cause)

  expect(error).toBeInstanceOf(MiddlewareError)
  expect((error as MiddlewareError).message).toContain(
    'Response middleware must return a valid ResponseType object'
  )
  expect((error as MiddlewareError).message).not.toContain(
    'Response middleware failed'
  )
  expect((error as MiddlewareError).cause).toBeUndefined()
  expect((error as MiddlewareError).type).toBe('response')
  expect((error as MiddlewareError).url).toBe('https://api.example.com/users')
  expect((error as MiddlewareError).method).toBe('GET')
})

it('should wrap thrown response middleware errors with response context', async () => {
  const onResponseMiddleware = vi.fn(() => {
    throw new Error('response boom')
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onResponseMiddleware,
  })

  server.use(
    http.get('https://api.example.com/users', () => {
      return HttpResponse.json({ users: [] })
    })
  )

  const error = await clientWithMiddleware
    .get('/users')
    .catch((cause: unknown) => cause)

  expect(error).toBeInstanceOf(MiddlewareError)
  expect((error as MiddlewareError).message).toContain(
    'Response middleware failed: response boom'
  )
  expect((error as MiddlewareError).cause?.message).toBe('response boom')
  expect((error as MiddlewareError).type).toBe('response')
  expect((error as MiddlewareError).url).toBe('https://api.example.com/users')
  expect((error as MiddlewareError).method).toBe('GET')
})

it('should not double-wrap MiddlewareError thrown by response middleware', async () => {
  const middlewareError = new MiddlewareError(
    'custom response error',
    'response'
  )
  const onResponseMiddleware = vi.fn(() => {
    throw middlewareError
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onResponseMiddleware,
  })

  server.use(
    http.get('https://api.example.com/users', () => {
      return HttpResponse.json({ users: [] })
    })
  )

  const error = await clientWithMiddleware
    .get('/users')
    .catch((cause: unknown) => cause)

  expect(error).toBe(middlewareError)
  expect((error as MiddlewareError).message).not.toContain(
    'Response middleware failed'
  )
})

it('should handle response middleware that returns null', async () => {
  const onResponseMiddleware = vi.fn(() => {
    return null as any // Invalid return - should trigger validation error
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onResponseMiddleware,
  })

  server.use(
    http.get('https://api.example.com/users', () => {
      return HttpResponse.json({ users: [] })
    })
  )

  await expect(clientWithMiddleware.get('/users')).rejects.toThrow(
    MiddlewareError
  )

  await expect(clientWithMiddleware.get('/users')).rejects.toThrow(
    'Response middleware must return a valid ResponseType object'
  )
})

it('should handle response middleware that returns object without data property', async () => {
  const onResponseMiddleware = vi.fn(() => {
    return { status: 200, statusText: 'OK' } as any // Missing 'data' property
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onResponseMiddleware,
  })

  server.use(
    http.get('https://api.example.com/users', () => {
      return HttpResponse.json({ users: [] })
    })
  )

  await expect(clientWithMiddleware.get('/users')).rejects.toThrow(
    MiddlewareError
  )

  await expect(clientWithMiddleware.get('/users')).rejects.toThrow(
    'Response middleware must return a valid ResponseType object'
  )
})

it('should handle response middleware that returns primitive value', async () => {
  const onResponseMiddleware = vi.fn(() => {
    return 'invalid response' as any // Primitive value - should trigger validation error
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onResponseMiddleware,
  })

  server.use(
    http.get('https://api.example.com/users', () => {
      return HttpResponse.json({ users: [] })
    })
  )

  await expect(clientWithMiddleware.get('/users')).rejects.toThrow(
    MiddlewareError
  )

  await expect(clientWithMiddleware.get('/users')).rejects.toThrow(
    'Response middleware must return a valid ResponseType object'
  )
})

it('should handle response middleware that returns valid ResponseType object', async () => {
  const onResponseMiddleware = vi.fn(response => {
    return {
      ...response,
      data: { ...response.data, processed: true },
    }
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onResponseMiddleware,
  })

  server.use(
    http.get('https://api.example.com/users', () => {
      return HttpResponse.json({ users: [] })
    })
  )

  const response = await clientWithMiddleware.get('/users')

  expect(response.data).toEqual({ users: [], processed: true })
  expect(response.status).toBe(200)
  expect(onResponseMiddleware).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 200,
      data: { users: [] },
    })
  )
})

it('should call response middleware for non-2xx responses before throwing HttpError', async () => {
  const onResponseMiddleware = vi.fn(response => {
    return {
      ...response,
      data: {
        ...response.data,
        normalized: true,
      },
    }
  })

  const clientWithMiddleware = createHttpClient({
    baseUrl: 'https://api.example.com',
    onResponseMiddleware,
  })

  server.use(
    http.get('https://api.example.com/users', () => {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    })
  )

  await expect(clientWithMiddleware.get('/users')).rejects.toMatchObject({
    name: 'HttpError',
    status: 401,
    data: {
      error: 'Unauthorized',
      normalized: true,
    },
  })

  expect(onResponseMiddleware).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 401,
      data: {
        error: 'Unauthorized',
      },
    })
  )
})

it('should use the middleware-updated method in response metadata', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  )

  const clientWithMiddleware = createHttpClient({
    fetch: fetchMock as typeof fetch,
    onRequestMiddleware: async context => {
      return {
        ...context,
        method: 'PROPFIND',
      }
    },
  })

  const response = await clientWithMiddleware.request(
    'https://api.example.com/custom',
    {
      method: 'GET',
    }
  )

  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.example.com/custom',
    expect.objectContaining({
      method: 'PROPFIND',
    })
  )
  expect(response.method).toBe('PROPFIND')
})

it('should use the middleware-updated method in HttpError metadata', async () => {
  const clientWithMiddleware = createHttpClient({
    fetch: (async () => {
      return new Response('{"error":"server"}', {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch,
    onRequestMiddleware: async context => {
      return {
        ...context,
        method: 'PROPFIND',
      }
    },
  })

  await expect(
    clientWithMiddleware.request('https://api.example.com/custom', {
      method: 'GET',
    })
  ).rejects.toMatchObject({
    name: 'HttpError',
    method: 'PROPFIND',
    status: 500,
  })
})
