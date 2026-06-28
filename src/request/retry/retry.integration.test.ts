import { expectTypeOf } from 'expect-type'
import { HttpResponse, http } from 'msw'
import { expect, it, vi } from 'vitest'
import { z } from 'zod'

import { createHttpClient } from '../../client'
import {
  ContractValidationError,
  HttpError,
  MiddlewareError,
  SerializationError,
  TimeoutError,
} from '../../errors'
import { server } from '../../testing/setup'
import { ResponseType } from '../../types'

it('retries on 500 errors and eventually succeeds with correct call count', async () => {
  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    retry: {
      maxRetries: 2,
      retryDelay: 1,
      retryStatusCodes: [500],
    },
  })

  let callCount = 0
  server.use(
    http.get('https://api.example.com/retry-test', () => {
      callCount += 1
      if (callCount <= 2) {
        return HttpResponse.json({}, { status: 500 })
      }
      return HttpResponse.json({ success: true }, { status: 200 })
    })
  )

  const retryResponse = await retryClient.get('/retry-test')
  expectTypeOf(retryResponse).toEqualTypeOf<ResponseType<unknown>>()
  expect(retryResponse.data).toEqual({ success: true })
  expect(callCount).toBe(3)
})

it('supports retry as the client-level retry shortcut', async () => {
  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    retry: {
      maxRetries: 2,
      retryDelay: 1,
      retryStatusCodes: [500],
    },
  })

  let callCount = 0
  server.use(
    http.get('https://api.example.com/retry-shortcut', () => {
      callCount += 1
      if (callCount <= 2) {
        return HttpResponse.json({}, { status: 500 })
      }
      return HttpResponse.json({ success: true }, { status: 200 })
    })
  )

  const retryResponse = await retryClient.get('/retry-shortcut')
  expect(retryResponse.data).toEqual({ success: true })
  expect(callCount).toBe(3)
})

it('lets request retry false disable client retry', async () => {
  let callCount = 0
  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async () => {
      callCount += 1
      return new Response('{"error":"server"}', {
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
    retryClient.get('/disabled-client-retry', { retry: false })
  ).rejects.toThrow(HttpError)
  expect(callCount).toBe(1)
})

it('retries HTTP status failures even when the error body is malformed', async () => {
  let callCount = 0
  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async () => {
      callCount += 1

      if (callCount === 1) {
        return new Response('not-json', {
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
      maxRetries: 1,
      retryDelay: 1,
      retryStatusCodes: [500],
    },
  })

  const response = await retryClient.get('/malformed-error-body')

  expect(response.data).toEqual({ success: true })
  expect(callCount).toBe(2)
})

it('does not retry unless retry options are enabled', async () => {
  let callCount = 0

  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async () => {
      callCount += 1
      return new Response('{"error":"server"}', {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch,
  })

  await expect(client.get('/no-default-retry')).rejects.toThrow(HttpError)
  expect(callCount).toBe(1)
})

it('does not retry on 400 client errors', async () => {
  let callCount = 0
  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async () => {
      callCount += 1
      return new Response('{"error":"bad request"}', {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch,
    retry: {
      maxRetries: 2,
      retryStatusCodes: [500, 502, 503],
    },
  })

  await expect(retryClient.get('/bad-request')).rejects.toThrow(HttpError)
  expect(callCount).toBe(1)
})

it('does not retry unsafe methods by default', async () => {
  let callCount = 0
  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async () => {
      callCount += 1
      return new Response('{"error":"server"}', {
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

  await expect(retryClient.post('/unsafe', { name: 'Ada' })).rejects.toThrow(
    HttpError
  )
  expect(callCount).toBe(1)
})

it('retries unsafe methods when explicitly enabled', async () => {
  let callCount = 0
  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async () => {
      callCount += 1

      if (callCount === 1) {
        return new Response('{"error":"server"}', {
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
      maxRetries: 1,
      retryDelay: 1,
      retryStatusCodes: [500],
      retryUnsafeMethods: true,
    },
  })

  const response = await retryClient.post('/unsafe', { name: 'Ada' })

  expect(response.data).toEqual({ success: true })
  expect(callCount).toBe(2)
})

it('does not retry one-shot ReadableStream request bodies', async () => {
  let callCount = 0
  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async () => {
      callCount += 1
      return new Response('{"error":"server"}', {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch,
    retry: {
      maxRetries: 2,
      retryDelay: 1,
      retryStatusCodes: [500],
      retryUnsafeMethods: true,
    },
  })

  await expect(
    retryClient.request('/stream', {
      method: 'POST',
      body: new ReadableStream(),
    })
  ).rejects.toThrow(HttpError)
  expect(callCount).toBe(1)
})

it('honors Retry-After, jitter, and onRetry metadata', async () => {
  let callCount = 0
  const onRetry = vi.fn()
  const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async () => {
      callCount += 1

      if (callCount === 1) {
        return new Response('{"error":"busy"}', {
          status: 503,
          headers: {
            'content-type': 'application/json',
            'retry-after': '0',
          },
        })
      }

      if (callCount === 2) {
        return new Response('{"error":"again"}', {
          status: 503,
          headers: { 'content-type': 'application/json' },
        })
      }

      return new Response('{"success":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch,
    retry: {
      maxRetries: 2,
      retryDelay: 10,
      retryStatusCodes: [503],
      jitter: 'full',
      onRetry,
    },
  })

  const response = await retryClient.get('/retry-after')

  expect(response.data).toEqual({ success: true })
  expect(onRetry).toHaveBeenCalledTimes(2)
  expect(onRetry).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      delay: 0,
      method: 'GET',
      nextAttempt: 1,
      retryCount: 0,
      url: 'https://api.example.com/retry-after',
    })
  )
  expect(onRetry).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      delay: 0,
      nextAttempt: 2,
      retryCount: 1,
    })
  )

  randomSpy.mockRestore()
})

it('uses exponential backoff with increasing delays', async () => {
  vi.useFakeTimers()

  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    retry: {
      maxRetries: 2,
      retryDelay: 10,
      backoffFactor: 2,
    },
  })

  try {
    const request = retryClient.get('/backoff-test')

    await vi.advanceTimersByTimeAsync(10)
    await vi.advanceTimersByTimeAsync(20)

    await expect(request).rejects.toThrow(HttpError)
  } finally {
    vi.useRealTimers()
  }
})

it('retries on network errors when enabled', async () => {
  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    retry: {
      maxRetries: 1,
      retryDelay: 0,
      retryNetworkErrors: true,
    },
  })

  const networkRetryResponse = await retryClient.get('/network-retry')
  expectTypeOf(networkRetryResponse).toEqualTypeOf<ResponseType<unknown>>()
  expect(networkRetryResponse.data).toEqual({ success: true })
})

it('does not retry response middleware failures by default', async () => {
  let callCount = 0

  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async () => {
      callCount += 1
      return new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch,
    onResponseMiddleware: () => undefined as never,
    retry: {
      maxRetries: 2,
      retryDelay: 1,
      retryStatusCodes: [500],
    },
  })

  await expect(retryClient.get('/middleware-failure')).rejects.toThrow(
    MiddlewareError
  )
  expect(callCount).toBe(1)
})

it('does not retry contract validation failures by default', async () => {
  let callCount = 0

  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async () => {
      callCount += 1
      return new Response('{"success":"nope"}', {
        status: 200,
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
    retryClient
      .get('/schema-failure')
      .contract(z.object({ success: z.boolean() }))
  ).rejects.toThrow(ContractValidationError)
  expect(callCount).toBe(1)
})

it('does not retry serialization failures by default', async () => {
  let callCount = 0

  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async () => {
      callCount += 1
      return new Response('not-json', {
        status: 200,
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
    retryClient.get('/serialization-failure', { responseType: 'json' })
  ).rejects.toThrow(SerializationError)
  expect(callCount).toBe(1)
})

it('lets custom shouldRetry override the built-in policy', async () => {
  let callCount = 0

  const retryClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async () => {
      callCount += 1

      if (callCount === 1) {
        return new Response('{"error":"retry me"}', {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      }

      return new Response('{"success":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch,
    retry: {
      maxRetries: 1,
      retryDelay: 1,
      retryStatusCodes: [500],
      shouldRetry: (_error, retryCount) => retryCount === 0,
    },
  })

  const response = await retryClient.get('/custom-should-retry')
  expect(response.data).toEqual({ success: true })
  expect(callCount).toBe(2)
})

it('should throw TimeoutError when request exceeds timeout', async () => {
  vi.useFakeTimers()

  const timeoutClient = createHttpClient({
    baseUrl: 'https://api.example.com',
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
    timeout: 10,
  })

  try {
    const request = timeoutClient.get('/slow')
    await vi.advanceTimersByTimeAsync(10)

    await expect(request).rejects.toThrow(TimeoutError)
  } finally {
    vi.useRealTimers()
  }
})
