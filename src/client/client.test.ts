import { expectTypeOf } from 'expect-type'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { createHttpClient } from '.'
import {
  AbortError,
  HttpError,
  InvalidBaseUrlError,
  SerializationError,
  TimeoutError,
} from '../errors'
import { ResponseType } from '../types'

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.email(),
})

type User = z.infer<typeof userSchema>

let client: ReturnType<typeof createHttpClient>

beforeEach(() => {
  client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })
})

describe('GET requests', () => {
  it('fetches users list without contract returns unknown', async () => {
    const usersResponse = await client.get('/users')
    expect(usersResponse.status).toBe(200)
    expectTypeOf(usersResponse).toEqualTypeOf<ResponseType<unknown>>()
  })

  it('returns complete response structure with all properties', async () => {
    const completeResponse = await client.get('/users')

    expect(completeResponse.status).toBe(200)
    expect(completeResponse.url).toBe('https://api.example.com/users')
    expect(completeResponse.headers).toBeDefined()
    expectTypeOf(completeResponse).toEqualTypeOf<ResponseType<unknown>>()
  })

  it('throws HttpError when server returns error status', async () => {
    await expect(client.get('/error')).rejects.toThrow(HttpError)
  })

  it('keeps malformed error responses classified as HttpError', async () => {
    const errorClient = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetch: (async () =>
        new Response('not-json', {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'content-type': 'application/json' },
        })) as typeof fetch,
    })

    const error = await errorClient.get('/broken-error').catch(cause => cause)

    expect(error).toBeInstanceOf(HttpError)
    expect(error.data).toBe('not-json')
    expect(error.cause).toBeInstanceOf(SerializationError)
  })

  it('throws TimeoutError when request exceeds timeout limit', async () => {
    const fastTimeoutClient = createHttpClient({
      baseUrl: 'https://api.example.com',
      timeout: 1,
    })
    await expect(fastTimeoutClient.get('/timeout')).rejects.toThrow(
      TimeoutError
    )
  })

  it('returns typed response when schema provided', async () => {
    const typedResponse = await client
      .get('/users/:id', {
        pathParams: { id: '1' },
      })
      .contract(userSchema)

    expect(typedResponse.data).toBeDefined()
    expectTypeOf(typedResponse).toEqualTypeOf<ResponseType<User>>()
  })

  it('validates response data against provided schema', async () => {
    const validatedResponse = await client
      .get('/users/:id', {
        pathParams: { id: '1' },
      })
      .contract(userSchema)

    expect(validatedResponse.data).toBeDefined()
    expectTypeOf(validatedResponse.data).toEqualTypeOf<User>()
  })
})

describe('POST', () => {
  it('creates new user without contract returns unknown', async () => {
    const createResponse = await client.post('/users', {
      name: 'Alice Johnson',
      email: 'alice@example.com',
    })
    expectTypeOf(createResponse).toEqualTypeOf<ResponseType<unknown>>()
    expect(createResponse.status).toBe(201)
  })

  it('returns typed response when response schema provided', async () => {
    const typedCreateResponse = await client
      .post('/users', {
        name: 'Alice Johnson',
        email: 'alice@example.com',
      })
      .contract(userSchema)

    expectTypeOf(typedCreateResponse).toEqualTypeOf<ResponseType<User>>()
    expect(typedCreateResponse.data).toBeDefined()
  })

  it('supports FormData for file uploads', async () => {
    const formData = new FormData()
    formData.append('name', 'Alice Johnson')
    formData.append('email', 'alice@example.com')

    const formResponse = await client.post('/users', formData)
    expect(formResponse.status).toBe(201)
    expectTypeOf(formResponse).toEqualTypeOf<ResponseType<unknown>>()
  })

  it('supports URLSearchParams', async () => {
    const params = new URLSearchParams()
    params.append('name', 'Alice Johnson')
    params.append('email', 'alice@example.com')

    const paramsResponse = await client.post('/users', params)
    expect(paramsResponse.status).toBe(201)
  })

  it('supports Blob uploads', async () => {
    const blob = new Blob(['test content'], { type: 'text/plain' })
    const blobResponse = await client.post('/upload', blob)
    expect(blobResponse.status).toBe(201)
  })
})

describe('DELETE requests', () => {
  it('works with path parameters on DELETE requests without contract returns unknown', async () => {
    const deleteResponse = await client.delete('/users/:id', {
      pathParams: { id: '1' },
    })

    expect(deleteResponse.status).toBe(200)
    expectTypeOf(deleteResponse).toEqualTypeOf<ResponseType<unknown>>()
  })

  it('infers response type with schema on DELETE requests', async () => {
    const deleteResponseSchema = z.object({ success: z.boolean() })
    const typedDeleteResponse = await client
      .delete('/users/:id', {
        pathParams: { id: '1' },
      })
      .contract(deleteResponseSchema)

    expectTypeOf(typedDeleteResponse.data).toEqualTypeOf<{ success: boolean }>()
  })
})

it('handles request cancellation with AbortController', async () => {
  const abortController = new AbortController()
  const abortClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async (_url, init) => {
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () =>
            reject(
              Object.assign(new Error('Request aborted by caller'), {
                name: 'AbortError',
              })
            ),
          { once: true }
        )
      })

      return new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch,
  })

  const pendingRequest = abortClient.get('/slow-request', {
    signal: abortController.signal,
  })
  abortController.abort()

  await expect(pendingRequest).rejects.toBeInstanceOf(AbortError)
  await expect(pendingRequest).rejects.toMatchObject({
    name: 'AbortError',
    message: 'Request aborted by caller',
  })
})

it('supports custom HTTP methods via request()', async () => {
  let capturedMethod: string | undefined

  const customMethodClient = createHttpClient({
    fetch: (async (_url, init) => {
      capturedMethod = init?.method
      return new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch,
  })

  const response = await customMethodClient.request(
    'https://api.example.com/webdav',
    {
      method: 'PROPFIND',
    }
  )

  expect(capturedMethod).toBe('PROPFIND')
  expect(response.method).toBe('PROPFIND')
})

describe('Schema Validation', () => {
  it('handles contract validation with deeply nested objects and unions', async () => {
    const addressSchema = z.object({
      street: z.string(),
      city: z.string(),
      country: z.string(),
      coordinates: z.object({
        lat: z.number(),
        lng: z.number(),
      }),
    })

    const profileSchema = z.object({
      bio: z.string(),
      avatar: z.url(),
      social: z.object({
        twitter: z.string().optional(),
        linkedin: z.string().optional(),
      }),
    })

    const complexUserSchema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.email(),
      status: z.union([
        z.literal('active'),
        z.literal('inactive'),
        z.literal('pending'),
      ]),
      address: addressSchema,
      profile: profileSchema,
      metadata: z.object({
        createdAt: z.iso.datetime(),
        lastLogin: z.iso.datetime().optional(),
        permissions: z.array(z.string()),
      }),
    })

    const detailedUserResponse = await client
      .get('/users/:id/detailed', {
        pathParams: { id: '1' },
      })
      .contract(complexUserSchema)

    expectTypeOf(detailedUserResponse.data).toEqualTypeOf<
      z.infer<typeof complexUserSchema>
    >()
  })
})

describe('Data Extractor', () => {
  it('extracts response data with .data()', async () => {
    const extractedUser = await client
      .get('/users/:id', {
        pathParams: { id: '1' },
      })
      .contract(userSchema)
      .data()

    expect(extractedUser.id).toBe(1)
    expectTypeOf(extractedUser).toEqualTypeOf<User>()
  })

  it('extracts data from GET requests without contract', async () => {
    const rawData = await client
      .get('/users/:id', {
        pathParams: { id: '1' },
      })
      .data()

    expect(rawData).toBeDefined()
    expect((rawData as any).id).toBe(1)
    expectTypeOf(rawData).toBeUnknown()
  })

  it('supports data extraction on POST requests', async () => {
    const createdUser = await client
      .post('/users', {
        name: 'Test User',
        email: 'test@example.com',
      })
      .contract(userSchema)
      .data()

    expect(createdUser.id).toBe(3)
    expectTypeOf(createdUser).toEqualTypeOf<User>()
  })

  it('supports data extraction on PUT requests', async () => {
    const updatedUser = await client
      .put(
        '/users/:id',
        {
          name: 'Updated User',
          email: 'updated@example.com',
        },
        {
          pathParams: { id: '1' },
        }
      )
      .contract(userSchema)
      .data()

    expect(updatedUser.name).toBe('Updated User')
    expectTypeOf(updatedUser).toEqualTypeOf<User>()
  })

  it('supports data extraction on PATCH requests', async () => {
    const patchedUser = await client
      .patch(
        '/users/:id',
        { name: 'Patched User' },
        {
          pathParams: { id: '1' },
        }
      )
      .contract(userSchema)
      .data()

    expect(patchedUser.name).toBe('Patched User')
    expectTypeOf(patchedUser).toEqualTypeOf<User>()
  })

  it('supports data extraction on DELETE requests', async () => {
    const deleteSchema = z.object({ success: z.boolean() })
    const deleteResult = await client
      .delete('/users/:id', {
        pathParams: { id: '1' },
      })
      .contract(deleteSchema)
      .data()

    expect(deleteResult.success).toBe(true)
    expectTypeOf(deleteResult).toEqualTypeOf<{ success: boolean }>()
  })

  it('fails gracefully when request fails', async () => {
    await expect(client.get('/error').data()).rejects.toThrow(HttpError)
  })

  it('respects retry: false on .data()', async () => {
    let callCount = 0

    const retryClient = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetch: (async () => {
        callCount += 1
        return new Response('{"error":"fail"}', {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      }) as typeof fetch,
      retry: {
        maxRetries: 2,
        retryDelay: 1,
        retryStatusCodes: [500],
      },
    })

    await expect(
      retryClient.get('/retry-test', { retry: false }).data()
    ).rejects.toThrow(HttpError)
    expect(callCount).toBe(1)
  })

  it('allows accessing full response when not using .data()', async () => {
    const fullResponse = await client
      .get('/users/:id', {
        pathParams: { id: '1' },
      })
      .contract(userSchema)

    expect(fullResponse.data).toBeDefined()
    expect(fullResponse.status).toBe(200)
    expect(fullResponse.headers).toBeDefined()
    expectTypeOf(fullResponse.data).toEqualTypeOf<User>()
  })
})

describe('Void Method', () => {
  it('triggers GET request and returns void without contract', async () => {
    const result = await client
      .get('/users/:id', {
        pathParams: { id: '1' },
      })
      .void()

    expect(result).toBeUndefined()
    expectTypeOf(result).toEqualTypeOf<void>()
  })

  it('triggers GET request with contract validation and returns void', async () => {
    const result = await client
      .get('/users/:id', {
        pathParams: { id: '1' },
      })
      .contract(userSchema)
      .void()

    expect(result).toBeUndefined()
    expectTypeOf(result).toEqualTypeOf<void>()
  })

  it('triggers POST request and returns void', async () => {
    const result = await client
      .post('/users', {
        name: 'Test User',
        email: 'test@example.com',
      })
      .contract(userSchema)
      .void()

    expect(result).toBeUndefined()
    expectTypeOf(result).toEqualTypeOf<void>()
  })

  it('triggers PUT request and returns void', async () => {
    const result = await client
      .put(
        '/users/:id',
        {
          name: 'Updated User',
          email: 'updated@example.com',
        },
        {
          pathParams: { id: '1' },
        }
      )
      .contract(userSchema)
      .void()

    expect(result).toBeUndefined()
    expectTypeOf(result).toEqualTypeOf<void>()
  })

  it('triggers PATCH request and returns void', async () => {
    const result = await client
      .patch(
        '/users/:id',
        { name: 'Patched User' },
        {
          pathParams: { id: '1' },
        }
      )
      .contract(userSchema)
      .void()

    expect(result).toBeUndefined()
    expectTypeOf(result).toEqualTypeOf<void>()
  })

  it('triggers DELETE request and returns void', async () => {
    const deleteSchema = z.object({ success: z.boolean() })
    const result = await client
      .delete('/users/:id', {
        pathParams: { id: '1' },
      })
      .contract(deleteSchema)
      .void()

    expect(result).toBeUndefined()
    expectTypeOf(result).toEqualTypeOf<void>()
  })

  it('still throws errors on failed requests', async () => {
    await expect(client.get('/error').void()).rejects.toThrow(HttpError)
  })

  it('validates schema before returning void', async () => {
    const invalidSchema = z.object({ invalid: z.string() })

    await expect(
      client
        .get('/users/:id', {
          pathParams: { id: '1' },
        })
        .contract(invalidSchema)
        .void()
    ).rejects.toThrow()
  })

  it('applies per-request retry overrides on .void()', async () => {
    let callCount = 0

    const retryClient = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetch: (async () => {
        callCount += 1

        if (callCount === 1) {
          return new Response('{"error":"retry"}', {
            status: 500,
            headers: { 'content-type': 'application/json' },
          })
        }

        return new Response('{"success":true}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }) as typeof fetch,
      retry: {
        maxRetries: 0,
        retryStatusCodes: [500],
      },
    })

    const result = await retryClient
      .get('/retry-test', {
        retry: {
          maxRetries: 1,
          retryDelay: 1,
          retryStatusCodes: [500],
        },
      })
      .void()

    expect(result).toBeUndefined()
    expectTypeOf(result).toEqualTypeOf<void>()
    expect(callCount).toBe(2)
  })
})

describe('Relative URL Support', () => {
  it('joins relative paths as baseUrl for custom fetch implementations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const relativeClient = createHttpClient({
      baseUrl: '/api',
      fetch: fetchMock as typeof fetch,
    })

    const response = await relativeClient.get('/users')

    expect(fetchMock).toHaveBeenCalledWith('/api/users', expect.any(Object))
    expect(response.url).toBe('/api/users')
  })

  it('preserves relative baseUrl paths when window origin exists', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    vi.stubGlobal('window', {
      location: { origin: 'https://app.example.com' },
    })

    try {
      const relativeClient = createHttpClient({
        baseUrl: '/api',
        fetch: fetchMock as typeof fetch,
      })

      const response = await relativeClient.get('/users')

      expect(fetchMock).toHaveBeenCalledWith('/api/users', expect.any(Object))
      expect(response.url).toBe('/api/users')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('resolves native fetch at request time', async () => {
    const originalFetch = globalThis.fetch
    const initialFetch = vi.fn().mockResolvedValue(
      new Response('{"stale":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    const requestFetch = vi.fn().mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    globalThis.fetch = initialFetch as typeof fetch
    const lazyClient = createHttpClient({
      baseUrl: 'https://api.example.com',
    })
    globalThis.fetch = requestFetch as typeof fetch

    try {
      const response = await lazyClient.get('/users')

      expect(initialFetch).not.toHaveBeenCalled()
      expect(requestFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.any(Object)
      )
      expect(response.data).toEqual({ ok: true })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('works with empty baseUrl in Node environment', async () => {
    const noBaseClient = createHttpClient()
    const absoluteUrlResponse = await noBaseClient.get(
      'https://api.example.com/users'
    )
    expect(absoluteUrlResponse.status).toBe(200)
  })

  it('works with empty baseUrl and uses full URLs in requests', async () => {
    const noBaseClient = createHttpClient()
    const fullUrlResponse = await noBaseClient.get(
      'https://api.example.com/users'
    )
    expect(fullUrlResponse.status).toBe(200)
    expect(fullUrlResponse.data).toBeDefined()
  })

  it('starts uncontracted requests even when the response is not awaited', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"ok":true}', {
        headers: { 'content-type': 'application/json' },
      })
    )
    const fireAndForgetClient = createHttpClient({
      fetch: fetchMock as typeof fetch,
    })

    void fireAndForgetClient.get('https://api.example.com/users')
    await Promise.resolve()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('returns real Promise instances from requests and contract views', async () => {
    const promiseClient = createHttpClient({
      fetch: (async () =>
        new Response('{"ok":true}', {
          headers: { 'content-type': 'application/json' },
        })) as typeof fetch,
    })

    const request = promiseClient.get('https://api.example.com/users')
    const contracted = request.contract(z.object({ ok: z.boolean() }))

    expect(request).toBeInstanceOf(Promise)
    expect(contracted).toBeInstanceOf(Promise)
    await expect(contracted.data()).resolves.toEqual({ ok: true })
  })

  it('throws a helpful error for relative URLs without baseUrl in Node', async () => {
    const noBaseClient = createHttpClient()

    await expect(noBaseClient.get('/users')).rejects.toThrow(
      InvalidBaseUrlError
    )
    await expect(noBaseClient.get('/users')).rejects.toThrow(
      'requires an absolute baseUrl in non-browser environments'
    )
  })

  it('handles relative baseUrl paths with leading slash', () => {
    const apiClient = createHttpClient({ baseUrl: '/api' })
    expect(apiClient).toBeDefined()
    const apiClientWithSlash = createHttpClient({ baseUrl: '/api/' })
    expect(apiClientWithSlash).toBeDefined()
  })

  it('handles absolute URLs correctly', async () => {
    const absoluteClient = createHttpClient({
      baseUrl: 'https://api.example.com',
    })
    const response = await absoluteClient.get('/users')
    expect(response.status).toBe(200)
    expect(response.url).toBe('https://api.example.com/users')
  })

  it('throws error for invalid baseUrl', () => {
    expect(() => {
      createHttpClient({
        baseUrl: 'not-a-valid-url',
      })
    }).toThrow('Invalid baseUrl')

    expect(() => {
      createHttpClient({
        baseUrl: 'ht!tp://invalid',
      })
    }).toThrow('Invalid baseUrl')
  })

  it('handles baseUrl with trailing slash correctly', () => {
    const clientWithSlash = createHttpClient({
      baseUrl: 'https://api.example.com/',
    })
    expect(clientWithSlash).toBeDefined()
  })

  it('constructs correct URLs when baseUrl has no trailing slash', async () => {
    const response = await client.get('/users')
    expect(response.url).toBe('https://api.example.com/users')
  })

  it('handles paths that start without slash', async () => {
    const response = await client.get('users')
    expect(response.status).toBe(200)
    expect(response.url).toBe('https://api.example.com/users')
  })

  it('handles absolute URLs in request even when baseUrl is set', async () => {
    const response = await client
      .get('https://api.example.com/test')
      .contract(z.any())
    expect(response.status).toBe(200)
    expect(response.url).toBe('https://api.example.com/test')
  })

  it('should concatenate baseUrl with path segments', async () => {
    const clientWithPath = createHttpClient({
      baseUrl: 'https://api.example.com',
    })

    const response = await clientWithPath.get('/test')

    expect(response.url).toBe('https://api.example.com/test')
    expect(response.data).toEqual({ status: 'ok', success: true })
  })

  it('should handle baseUrl with trailing slash and path segments', async () => {
    const clientWithSlash = createHttpClient({
      baseUrl: 'https://api.example.com/',
    })

    const response = await clientWithSlash.get('/test')

    expect(response.url).toBe('https://api.example.com/test')
  })

  it('should handle request URL without leading slash with path segments', async () => {
    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
    })

    const response = await client.get('test')

    expect(response.url).toBe('https://api.example.com/test')
  })

  it('should handle empty request URL with path segments', async () => {
    const client = createHttpClient({
      baseUrl: 'https://api.example.com/users',
    })

    const response = await client.get('')

    expect(response.url).toBe('https://api.example.com/users')
  })

  it('should handle absolute URLs in request with path segments baseUrl', async () => {
    const client = createHttpClient({
      baseUrl: 'https://api.example.com/users',
    })

    const response = await client.get('https://api.example.com/test')

    expect(response.url).toBe('https://api.example.com/test')
  })

  it('should concatenate baseUrl with path segments when using relative URLs', async () => {
    const client = createHttpClient({
      baseUrl: 'https://api.example.com/users',
    })

    const response = await client.get('/1')

    expect(response.url).toBe('https://api.example.com/users/1')
  })

  it('should return undefined for no-body responses', async () => {
    const response = await client.get('/empty')

    expect(response.data).toBeUndefined()
  })

  it('should validate schema with valid JSON response data', async () => {
    const validSchema = z.object({
      id: z.number(),
      name: z.string(),
    })

    const response = await client.get('/users/1').contract(validSchema)
    expect(response.data).toEqual({ id: 1, name: 'John Doe' })
  })
})
