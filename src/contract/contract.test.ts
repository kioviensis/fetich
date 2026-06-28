import { expectTypeOf } from 'expect-type'
import { http, HttpResponse } from 'msw'
import { expect, it } from 'vitest'
import { z } from 'zod'

import { createHttpClient } from '../client'
import {
  ContractValidationError,
  HttpError,
  InvalidContractError,
  InvalidSchemaError,
  SchemaValidationError,
} from '../errors'
import { server } from '../testing/setup'
import type { InferContractError, ResponseType } from '../types'

it('validates error response contracts before throwing HttpError', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })
  const createdTransactionSchema = z.object({ id: z.string() })
  const alreadyCreatedTransactionSchema = z.object({
    code: z.literal('already_created'),
    transactionId: z.string(),
  })

  server.use(
    http.post('https://api.example.com/transactions', () => {
      return HttpResponse.json(
        {
          code: 'already_created',
          transactionId: 'tx_123',
        },
        { status: 409 }
      )
    })
  )

  const request = client.post('/transactions', {}).contract({
    success: createdTransactionSchema,
    error: {
      409: alreadyCreatedTransactionSchema,
    },
  })

  const error = await request.catch(cause => cause)

  expect(error).toBeInstanceOf(HttpError)
  expect(error).toMatchObject({
    status: 409,
    data: {
      code: 'already_created',
      transactionId: 'tx_123',
    },
  })
})

it('uses exact success status contracts before the success default', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.post('https://api.example.com/transactions', () => {
      return HttpResponse.json(null, { status: 201 })
    })
  )

  const response = await client.post('/transactions', {}).contract({
    success: {
      default: z.object({ id: z.string() }),
      201: z.null(),
    },
  })

  expect(response.status).toBe(201)
  expect(response.data).toBeNull()
})

it('uses the success default when no exact success status matches', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.post('https://api.example.com/transactions', () => {
      return HttpResponse.json({ id: 'tx_123' }, { status: 200 })
    })
  )

  const response = await client.post('/transactions', {}).contract({
    success: {
      default: z.object({ id: z.string() }),
      201: z.undefined(),
    },
  })

  expect(response.status).toBe(200)
  expect(response.data).toEqual({ id: 'tx_123' })
})

it('keeps plain schema contracts success-only on HTTP errors', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.get('https://api.example.com/failed-status', () => {
      return HttpResponse.json({ id: 'tx_123' }, { status: 500 })
    })
  )

  await expect(
    client.get('/failed-status').contract(z.object({ id: z.string() }))
  ).rejects.toThrow(HttpError)
})

it('keeps success defaults success-only on HTTP errors', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.get('https://api.example.com/failed-default-status', () => {
      return HttpResponse.json({ id: 'tx_123' }, { status: 500 })
    })
  )

  const error = await client
    .get('/failed-default-status')
    .contract({
      success: {
        default: z.object({ id: z.string() }),
      },
    })
    .catch(cause => cause)

  expect(error).toBeInstanceOf(HttpError)
  expect(error).toMatchObject({
    status: 500,
    data: { id: 'tx_123' },
  })
})

it('uses exact error status contracts before the error default', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.post('https://api.example.com/transactions', () => {
      return HttpResponse.json(
        { code: 'already_created', transactionId: 'tx_123' },
        { status: 409 }
      )
    })
  )

  const error = await client
    .post('/transactions', {})
    .contract({
      success: z.object({ id: z.string() }),
      error: {
        default: z.object({ code: z.literal('generic_error') }),
        409: z.object({
          code: z.literal('already_created'),
          transactionId: z.string(),
        }),
      },
    })
    .catch(cause => cause)

  expect(error).toBeInstanceOf(HttpError)
  expect(error).toMatchObject({
    status: 409,
    data: {
      code: 'already_created',
      transactionId: 'tx_123',
    },
  })
})

it('uses the error default when no exact error status matches', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.post('https://api.example.com/transactions', () => {
      return HttpResponse.json(
        { code: 'rate_limited', retryAfter: 30 },
        { status: 429 }
      )
    })
  )

  const error = await client
    .post('/transactions', {})
    .contract({
      success: z.object({ id: z.string() }),
      error: {
        default: z.object({ code: z.string(), retryAfter: z.number() }),
        409: z.object({ code: z.literal('already_created') }),
      },
    })
    .catch(cause => cause)

  expect(error).toBeInstanceOf(HttpError)
  expect(error).toMatchObject({
    status: 429,
    data: {
      code: 'rate_limited',
      retryAfter: 30,
    },
  })
})

it('supports schema branches as success and error catch-alls', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.post('https://api.example.com/schema-branches', () => {
      return HttpResponse.json({ code: 'invalid_input' }, { status: 400 })
    })
  )

  const error = await client
    .post('/schema-branches', {})
    .contract({
      success: z.object({ id: z.string() }),
      error: z.object({ code: z.string() }),
    })
    .catch(cause => cause)

  expect(error).toBeInstanceOf(HttpError)
  expect(error).toMatchObject({
    status: 400,
    data: { code: 'invalid_input' },
  })
})

it('preserves the original HttpError when no error contract matches', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.post('https://api.example.com/uncontracted-error', () => {
      return HttpResponse.json({ message: 'Conflict' }, { status: 409 })
    })
  )

  const error = await client
    .post('/uncontracted-error', {})
    .contract({
      success: z.object({ id: z.string() }),
      error: {
        400: z.object({ code: z.literal('bad_request') }),
      },
    })
    .catch(cause => cause)

  expect(error).toBeInstanceOf(HttpError)
  expect(error).not.toBeInstanceOf(ContractValidationError)
  expect(error).toMatchObject({
    status: 409,
    data: { message: 'Conflict' },
  })
})

it('throws ContractValidationError when an error response fails its contract', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })
  const createdTransactionSchema = z.object({ id: z.string() })
  const badTransactionResponseSchema = z.object({
    code: z.literal('bad_transaction'),
  })

  server.use(
    http.post('https://api.example.com/transactions', () => {
      return HttpResponse.json({ message: 'Missing amount' }, { status: 400 })
    })
  )

  const request = client.post('/transactions', {}).contract({
    success: createdTransactionSchema,
    error: {
      400: badTransactionResponseSchema,
    },
  })

  const error = await request.catch(cause => cause)

  expect(error).toBeInstanceOf(ContractValidationError)
  expect(error).toBeInstanceOf(SchemaValidationError)
  expect(error).toMatchObject({
    branch: 'error',
    status: 400,
    data: { message: 'Missing amount' },
    method: 'POST',
    url: 'https://api.example.com/transactions',
  })
  expect(error.cause).toBeInstanceOf(SchemaValidationError)
})

it('throws ContractValidationError when a success response fails its contract', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.post('https://api.example.com/invalid-success', () => {
      return HttpResponse.json({ id: 123 }, { status: 200 })
    })
  )

  const error = await client
    .post('/invalid-success', {})
    .contract({
      success: z.object({ id: z.string() }),
    })
    .catch(cause => cause)

  expect(error).toBeInstanceOf(ContractValidationError)
  expect(error).toMatchObject({
    branch: 'success',
    status: 200,
    data: { id: 123 },
    method: 'POST',
    url: 'https://api.example.com/invalid-success',
  })
})

it('throws ContractValidationError when exact 3xx success contract validation fails', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.get('https://api.example.com/invalid-cache-success', () => {
      return new HttpResponse(null, { status: 304 })
    })
  )

  const error = await client
    .get('/invalid-cache-success')
    .contract({
      success: {
        304: z.object({ answer: z.number() }),
      },
      error: {
        default: z.object({ code: z.string() }),
      },
    })
    .catch(cause => cause)

  expect(error).toBeInstanceOf(ContractValidationError)
  expect(error).toMatchObject({
    branch: 'success',
    status: 304,
    data: undefined,
  })
})

it('does not retry exact 3xx success statuses declared by contract', async () => {
  let callCount = 0
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
    retry: {
      maxRetries: 2,
      retryDelay: 1,
      retryStatusCodes: [304],
    },
  })

  server.use(
    http.get('https://api.example.com/contracted-cache-hit', () => {
      callCount += 1
      return new HttpResponse(null, { status: 304 })
    })
  )

  const response = await client.get('/contracted-cache-hit').contract({
    success: {
      304: z.undefined(),
    },
  })

  expect(callCount).toBe(1)
  expect(response.status).toBe(304)
  expect(response.data).toBeUndefined()
})

it('throws InvalidContractError when a successful response has no matching success contract', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.post('https://api.example.com/missing-success-contract', () => {
      return HttpResponse.json({ id: 'tx_123' }, { status: 200 })
    })
  )

  const error = await client
    .post('/missing-success-contract', {})
    .contract({
      success: {
        201: z.undefined(),
      },
    })
    .catch(cause => cause)

  expect(error).toBeInstanceOf(InvalidContractError)
  expect(error).toMatchObject({
    branch: 'success',
    status: 200,
  })
})

it('throws InvalidContractError for malformed contract objects before sending a request', async () => {
  let callCount = 0
  const client = createHttpClient({
    fetch: (async () => {
      callCount += 1
      return new Response('{"ok":true}', {
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch,
  })

  await expect(
    client.get('https://api.example.com/missing-success').contract({
      error: z.object({ code: z.string() }),
    } as never)
  ).rejects.toThrow(InvalidContractError)

  await expect(
    client.get('https://api.example.com/invalid-direct-schema').contract({
      parse: (value: unknown) => value,
    } as never)
  ).rejects.toThrow(InvalidContractError)

  await expect(
    client.get('https://api.example.com/invalid-success-branch').contract({
      success: undefined,
    } as never)
  ).rejects.toThrow(InvalidContractError)

  await expect(
    client.get('https://api.example.com/invalid-success-status').contract({
      success: {
        401: z.object({ code: z.string() }),
      },
    } as never)
  ).rejects.toThrow(InvalidContractError)

  await expect(
    client.get('https://api.example.com/invalid-error-status').contract({
      success: z.object({ ok: z.boolean() }),
      error: {
        304: z.undefined(),
      },
    } as never)
  ).rejects.toThrow(InvalidContractError)

  await expect(
    client.get('https://api.example.com/invalid-status-key').contract({
      success: {
        sucess: z.object({ ok: z.boolean() }),
      },
    } as never)
  ).rejects.toThrow(InvalidContractError)

  expect(callCount).toBe(0)
})

it('rejects when a contract is attached after auto-start', async () => {
  let callCount = 0
  const client = createHttpClient({
    fetch: (async () => {
      callCount += 1
      return new Response('{"ok":true}', {
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch,
  })

  const request = client.get('https://api.example.com/users')
  await Promise.resolve()

  await expect(request.contract(z.object({ ok: z.boolean() }))).rejects.toThrow(
    InvalidContractError
  )

  expect(callCount).toBe(1)
})

it('rejects late status-map contracts after the request has started', async () => {
  let callCount = 0
  const client = createHttpClient({
    fetch: (async () => {
      callCount += 1
      return new Response(null, { status: 304 })
    }) as typeof fetch,
  })

  const request = client.get('https://api.example.com/cached-users')
  await Promise.resolve()

  await expect(
    request.contract({
      success: {
        304: z.undefined(),
      },
    })
  ).rejects.toThrow(InvalidContractError)

  expect(callCount).toBe(1)
})

it('throws InvalidSchemaError for an invalid selected contract schema', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.post('https://api.example.com/invalid-schema-contract', () => {
      return HttpResponse.json({ id: 'tx_123' }, { status: 200 })
    })
  )

  await expect(
    client.post('/invalid-schema-contract', {}).contract({
      success: {
        default: { parse: (value: unknown) => value } as never,
      },
    })
  ).rejects.toThrow(InvalidSchemaError)
})

it('runs contract validation through data and void extractors', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.get('https://api.example.com/extract-data', () => {
      return HttpResponse.json({ id: 'tx_123' })
    }),
    http.get('https://api.example.com/extract-void', () => {
      return HttpResponse.json({ id: 123 })
    })
  )

  await expect(
    client
      .get('/extract-data')
      .contract(z.object({ id: z.string() }))
      .data()
  ).resolves.toEqual({ id: 'tx_123' })

  await expect(
    client
      .get('/extract-void')
      .contract(z.object({ id: z.string() }))
      .void()
  ).rejects.toThrow(ContractValidationError)
})

it('allows an exact success status contract to handle a default HTTP non-success status', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.get('https://api.example.com/cached-transactions', () => {
      return new HttpResponse(null, { status: 304 })
    })
  )

  const response = await client.get('/cached-transactions').contract({
    success: {
      default: z.object({ id: z.string() }),
      304: z.undefined(),
    },
    error: {
      default: z.object({ code: z.string() }),
    },
  })

  expect(response.status).toBe(304)
  expect(response.data).toBeUndefined()
})

it('infers success data as a union across success status contracts', async () => {
  const createdTransactionSchema = z.object({ id: z.string() })
  const acceptedTransactionSchema = z.object({ accepted: z.literal(true) })
  const errorSchema = z.object({ code: z.string() })
  const client = createHttpClient({
    fetch: (async () =>
      new Response(JSON.stringify({ id: 'tx_123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch,
  })

  const response = await client
    .post('https://api.example.com/transactions', {
      amount: 100,
    })
    .contract({
      success: {
        default: createdTransactionSchema,
        202: acceptedTransactionSchema,
      },
      error: {
        default: errorSchema,
      },
    })

  expect(response.data).toEqual({ id: 'tx_123' })
  expectTypeOf(response).toEqualTypeOf<
    ResponseType<{ id: string } | { accepted: true }>
  >()
})

it('infers error data as a union across error status contracts', () => {
  const contract = {
    success: z.object({ id: z.string() }),
    error: {
      default: z.object({ kind: z.literal('generic'), code: z.string() }),
      400: z.object({
        kind: z.literal('bad_request'),
        code: z.literal('bad_transaction'),
        field: z.string(),
      }),
      409: z.object({
        kind: z.literal('conflict'),
        code: z.literal('already_created'),
        transactionId: z.string(),
      }),
    },
  }

  expect(contract).toBeDefined()
  expectTypeOf<InferContractError<typeof contract>>().toEqualTypeOf<
    | { kind: 'generic'; code: string }
    | { kind: 'bad_request'; code: 'bad_transaction'; field: string }
    | { kind: 'conflict'; code: 'already_created'; transactionId: string }
  >()
})
