import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { createHttpClient } from '../../client'
import { NetworkError } from '../../errors'
import { server } from '../../testing/setup'

const createTestClient = (config: any = {}) => {
  return createHttpClient({
    baseUrl: 'https://api.example.com',
    ...config,
  })
}

const createMockHandler = (
  assertions: (request: Request) => void | Promise<void>
) => {
  return vi.fn().mockImplementation(async ({ request }) => {
    await assertions(request)
    return HttpResponse.json({ success: true })
  })
}

const setupMockEndpoint = (
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  handler: any
) => {
  server.use(http[method](`https://api.example.com${path}`, handler))
}

describe('Custom Body Serializer', () => {
  it('applies custom body serializer for pretty-printed JSON', async () => {
    const customSerializeBody = vi.fn((body: any) => {
      if (typeof body === 'object' && body !== null) {
        return JSON.stringify(body, null, 2)
      }
      return body
    })

    const api = createTestClient({ serializeBody: customSerializeBody })
    const testData = { name: 'John', age: 30 }

    const mockHandler = createMockHandler(async request => {
      const body = await request.text()
      expect(body).toBe('{\n  "name": "John",\n  "age": 30\n}')
    })

    setupMockEndpoint('post', '/users', mockHandler)
    await api.post('/users', testData)

    expect(customSerializeBody).toHaveBeenCalledWith(testData)
    expect(mockHandler).toHaveBeenCalled()
  })

  it('handles null/undefined return from custom serializer', async () => {
    const customSerializeBody = vi.fn(() => null)
    const api = createTestClient({ serializeBody: customSerializeBody })

    const mockHandler = createMockHandler(async request => {
      const body = await request.text()
      expect(body).toBe('')
    })

    setupMockEndpoint('post', '/users', mockHandler)
    await api.post('/users', { test: 'data' })

    expect(customSerializeBody).toHaveBeenCalled()
    expect(mockHandler).toHaveBeenCalled()
  })

  it('falls back to default JSON serialization when no custom serializer', async () => {
    const api = createTestClient()
    const testData = { name: 'John', age: 30 }

    const mockHandler = createMockHandler(async request => {
      const body = await request.text()
      expect(body).toBe('{"name":"John","age":30}')
    })

    setupMockEndpoint('post', '/users', mockHandler)
    await api.post('/users', testData)

    expect(mockHandler).toHaveBeenCalled()
  })

  it('does not infer content-type for custom serializers', async () => {
    const customSerializeBody = vi.fn((body: any) => JSON.stringify(body))
    const api = createTestClient({ serializeBody: customSerializeBody })

    const mockHandler = createMockHandler(async request => {
      expect(request.headers.get('content-type')).not.toBe('application/json')
    })

    setupMockEndpoint('post', '/users', mockHandler)
    await api.post('/users', { test: 'data' })

    expect(mockHandler).toHaveBeenCalled()
  })

  it('preserves explicit content-type with custom serializers', async () => {
    const customSerializeBody = vi.fn((body: any) => JSON.stringify(body))
    const api = createTestClient({ serializeBody: customSerializeBody })

    const mockHandler = createMockHandler(async request => {
      expect(request.headers.get('content-type')).toBe('application/json')
    })

    setupMockEndpoint('post', '/users', mockHandler)
    await api.post(
      '/users',
      { test: 'data' },
      {
        headers: { 'content-type': 'application/json' },
      }
    )

    expect(mockHandler).toHaveBeenCalled()
  })

  it('does not infer JSON content-type for custom non-JSON strings', async () => {
    const customSerializeBody = vi.fn(
      (body: { name: string }) => `<user>${body.name}</user>`
    )
    const api = createTestClient({ serializeBody: customSerializeBody })

    const mockHandler = createMockHandler(async request => {
      expect(request.headers.get('content-type')).not.toBe('application/json')
      expect(await request.text()).toBe('<user>John</user>')
    })

    setupMockEndpoint('post', '/users', mockHandler)
    await api.post('/users', { name: 'John' })

    expect(mockHandler).toHaveBeenCalled()
  })
})

describe('Custom Params Serializer', () => {
  it('applies custom params serializer for URL encoding', async () => {
    const customSerializeParams = vi.fn((params: Record<string, any>) => {
      return Object.entries(params)
        .filter(([, value]) => value != null)
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join('&')
    })

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      serializeParams: customSerializeParams,
    })

    const testParams = { search: 'test query', page: 1, active: true }

    const mockHandler = vi.fn().mockImplementation(async ({ request }) => {
      const url = new URL(request.url)
      expect(url.search).toBe('?search=test%20query&page=1&active=true')
      return HttpResponse.json({ success: true })
    })

    server.use(http.get('https://api.example.com/search', mockHandler))

    await api.get('/search', { params: testParams })

    expect(customSerializeParams).toHaveBeenCalledWith(testParams)
    expect(mockHandler).toHaveBeenCalled()
  })

  it('handles empty string return from custom params serializer', async () => {
    const customSerializeParams = vi.fn(() => '')

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      serializeParams: customSerializeParams,
    })

    const mockHandler = vi.fn().mockImplementation(async ({ request }) => {
      const url = new URL(request.url)
      expect(url.search).toBe('')
      return HttpResponse.json({ success: true })
    })

    server.use(http.get('https://api.example.com/search', mockHandler))

    await api.get('/search', { params: { test: 'value' } })

    expect(customSerializeParams).toHaveBeenCalled()
    expect(mockHandler).toHaveBeenCalled()
  })

  it('strips leading question mark from custom params serializer output', async () => {
    const customSerializeParams = vi.fn(() => '?test=value')

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      serializeParams: customSerializeParams,
    })

    const mockHandler = vi.fn().mockImplementation(async ({ request }) => {
      const url = new URL(request.url)
      expect(url.search).toBe('?test=value')
      return HttpResponse.json({ success: true })
    })

    server.use(http.get('https://api.example.com/search', mockHandler))

    await api.get('/search', { params: { test: 'value' } })

    expect(mockHandler).toHaveBeenCalled()
  })

  it('falls back to default URLSearchParams serialization when no custom serializer', async () => {
    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      // No custom serializer
    })

    const testParams = { search: 'test', page: 1 }

    const mockHandler = vi.fn().mockImplementation(async ({ request }) => {
      const url = new URL(request.url)
      expect(url.search).toBe('?search=test&page=1')
      return HttpResponse.json({ success: true })
    })

    server.use(http.get('https://api.example.com/search', mockHandler))

    await api.get('/search', { params: testParams })

    expect(mockHandler).toHaveBeenCalled()
  })

  it('handles array parameters with custom serializer', async () => {
    const customSerializeParams = vi.fn((params: Record<string, any>) => {
      return Object.entries(params)
        .filter(([, value]) => value != null)
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return value.map(v => `${key}[]=${v}`).join('&')
          }
          return `${key}=${value}`
        })
        .join('&')
    })

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      serializeParams: customSerializeParams,
    })

    const testParams = { tags: ['react', 'typescript'], active: true }

    const mockHandler = vi.fn().mockImplementation(async ({ request }) => {
      const url = new URL(request.url)
      expect(url.search).toBe('?tags[]=react&tags[]=typescript&active=true')
      return HttpResponse.json({ success: true })
    })

    server.use(http.get('https://api.example.com/search', mockHandler))

    await api.get('/search', { params: testParams })

    expect(customSerializeParams).toHaveBeenCalledWith(testParams)
    expect(mockHandler).toHaveBeenCalled()
  })
})

describe('Custom Fetch Implementation', () => {
  it('uses custom fetch implementation for requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('{"message": "custom fetch response"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    })

    const response = await api.get('/users')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        method: 'GET',
        headers: expect.any(Headers),
      })
    )

    expect(response.status).toBe(200)
    expect(response.data).toEqual({ message: 'custom fetch response' })
  })

  it('propagates errors from custom fetch implementation', async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValue(new Error('Custom fetch network error'))

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    })

    await expect(api.get('/users')).rejects.toThrow(NetworkError)
    await expect(api.get('/users')).rejects.toThrow(
      'Custom fetch network error'
    )

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('passes all request options to custom fetch implementation', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('{"success": true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    })

    const testData = { name: 'John' }
    await api.post('/users', testData, {
      headers: { 'X-Custom': 'header' },
      timeout: 5_000,
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
        signal: expect.any(AbortSignal),
        duplex: 'half',
      })
    )

    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[1].body).toBe('{"name":"John"}')
  })

  it('passes fetchOptions through while allowing aliases to override', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('{"success": true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
    })

    await api.get('/users', {
      fetchOptions: {
        cache: 'force-cache',
        keepalive: true,
        redirect: 'follow',
      },
      cache: 'no-store',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({
        cache: 'no-store',
        keepalive: true,
        redirect: 'follow',
      })
    )
  })

  it('falls back to native fetch when no custom implementation provided', async () => {
    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      // No custom fetch - should use native fetch
    })

    const mockHandler = vi.fn().mockImplementation(async () => {
      return HttpResponse.json({ message: 'native fetch' })
    })

    server.use(http.get('https://api.example.com/users', mockHandler))

    const response = await api.get('/users')

    expect(mockHandler).toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(response.data).toEqual({ message: 'native fetch' })
  })
})

describe('Combined Features', () => {
  it('works with all custom features enabled simultaneously', async () => {
    const customFetch = vi.fn().mockResolvedValue(
      new Response('{"success": true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const customSerializeBody = vi.fn((body: any) =>
      JSON.stringify(body, null, 2)
    )

    const customSerializeParams = vi.fn((params: Record<string, any>) => {
      return Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&')
    })

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetch: customFetch,
      serializeBody: customSerializeBody,
      serializeParams: customSerializeParams,
    })

    const testData = { name: 'John', age: 30 }
    const testParams = { search: 'test', page: 1 }

    await api.post('/users', testData, { params: testParams })

    expect(customSerializeBody).toHaveBeenCalledWith(testData)
    expect(customSerializeParams).toHaveBeenCalledWith(testParams)
    expect(customFetch).toHaveBeenCalledWith(
      'https://api.example.com/users?search=test&page=1',
      expect.objectContaining({
        method: 'POST',
      })
    )

    const callArgs = customFetch.mock.calls[0]
    expect(callArgs[1].body).toBe('{\n  "name": "John",\n  "age": 30\n}')
  })

  it('maintains TypeScript type safety with custom serializers', async () => {
    const customSerializeBody = vi.fn((body: unknown) => JSON.stringify(body))

    const api = createHttpClient({
      baseUrl: 'https://api.example.com',
      serializeBody: customSerializeBody,
    })

    const testData = { name: 'John', age: 30 }

    const mockHandler = vi.fn().mockImplementation(async ({ request }) => {
      const body = await request.text()
      expect(body).toBe('{"name":"John","age":30}')
      return HttpResponse.json({ success: true })
    })

    server.use(http.post('https://api.example.com/users', mockHandler))

    await api.post('/users', testData)

    expect(customSerializeBody).toHaveBeenCalledWith(testData)
    expect(mockHandler).toHaveBeenCalled()
  })
})
