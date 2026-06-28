import { expectTypeOf } from 'expect-type'
import { http, HttpResponse } from 'msw'
import { it } from 'vitest'
import { z } from 'zod'

import { createHttpClient } from '../client'
import { server } from '../testing/setup'

let client: ReturnType<typeof createHttpClient>

beforeEach(() => {
  client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 5_000,
  })
})

it('validates string response with z.string()', async () => {
  server.use(
    http.get('https://api.example.com/text', () => {
      return new HttpResponse('Hello, World!', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    })
  )

  const response = await client
    .get('/text', {
      responseType: 'text',
    })
    .contract(z.string())

  expect(response.data).toBe('Hello, World!')
  expectTypeOf(response.data).toEqualTypeOf<string>()
})

it('validates number responses (parsed from JSON)', async () => {
  server.use(
    http.get('https://api.example.com/number', () => {
      return HttpResponse.json(42)
    })
  )

  const response = await client.get('/number').contract(z.number())

  expect(response.data).toBe(42)
  expectTypeOf(response.data).toEqualTypeOf<number>()
})

it('validates boolean responses (parsed from JSON)', async () => {
  server.use(
    http.get('https://api.example.com/bool', () => {
      return HttpResponse.json(true)
    })
  )

  const response = await client.get('/bool').contract(z.boolean())

  expect(response.data).toBe(true)
  expectTypeOf(response.data).toEqualTypeOf<boolean>()
})

it('validates null responses', async () => {
  server.use(
    http.get('https://api.example.com/null', () => {
      return HttpResponse.json(null)
    })
  )

  const response = await client.get('/null').contract(z.null())

  expect(response.data).toBe(null)
  expectTypeOf(response.data).toEqualTypeOf<null>()
})

it('validates Blob responses', async () => {
  server.use(
    http.get('https://api.example.com/blob', async () => {
      const blob = new Blob(['binary data'], {
        type: 'application/octet-stream',
      })
      return new HttpResponse(await blob.arrayBuffer(), {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      })
    })
  )

  const response = await client
    .get('/blob', {
      responseType: 'blob',
    })
    .contract(z.instanceof(Blob))

  expect(response.data).toBeInstanceOf(Blob)
  expectTypeOf(response.data).toEqualTypeOf<Blob>()
})

it('validates ArrayBuffer responses', async () => {
  server.use(
    http.get('https://api.example.com/arraybuffer', () => {
      const buffer = new ArrayBuffer(16)
      return HttpResponse.arrayBuffer(buffer, {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      })
    })
  )

  const response = await client
    .get('/arraybuffer', {
      responseType: 'arrayBuffer',
    })
    .contract(z.instanceof(ArrayBuffer))

  expect(response.data).toBeInstanceOf(ArrayBuffer)
  expect(response.data.byteLength).toBe(16)
  expectTypeOf(response.data).toEqualTypeOf<ArrayBuffer>()
})

it('validates Uint8Array responses (via ArrayBuffer)', async () => {
  server.use(
    http.get('https://api.example.com/uint8array', () => {
      const arr = new Uint8Array([1, 2, 3, 4, 5])
      return HttpResponse.arrayBuffer(arr.buffer, {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      })
    })
  )

  const schema = z.instanceof(ArrayBuffer).transform(buf => new Uint8Array(buf))

  const response = await client
    .get('/uint8array', {
      responseType: 'arrayBuffer',
    })
    .contract(schema)

  expect(response.data).toBeInstanceOf(Uint8Array)
  expect(response.data.length).toBe(5)
  expectTypeOf(response.data).toEqualTypeOf<z.infer<typeof schema>>()
})

it('validates object responses', async () => {
  server.use(
    http.get('https://api.example.com/object', () => {
      return HttpResponse.json({ id: '123', name: 'John', age: 30 })
    })
  )

  const schema = z.object({
    id: z.string(),
    name: z.string(),
    age: z.number(),
  })
  const response = await client.get('/object').contract(schema)

  expect(response.data).toEqual({ id: '123', name: 'John', age: 30 })
  expectTypeOf(response.data).toEqualTypeOf<{
    id: string
    name: string
    age: number
  }>()
})

it('validates array responses', async () => {
  server.use(
    http.get('https://api.example.com/array', () => {
      return HttpResponse.json([1, 2, 3, 4, 5])
    })
  )

  const schema = z.array(z.number())
  const response = await client.get('/array').contract(schema)

  expect(response.data).toEqual([1, 2, 3, 4, 5])
  expectTypeOf(response.data).toEqualTypeOf<number[]>()
})

it('validates nested object responses', async () => {
  server.use(
    http.get('https://api.example.com/nested', () => {
      return HttpResponse.json({
        user: { id: '1', name: 'Alice' },
        posts: [
          { id: '1', title: 'Post 1' },
          { id: '2', title: 'Post 2' },
        ],
        metadata: { total: 2, page: 1 },
      })
    })
  )

  const schema = z.object({
    user: z.object({ id: z.string(), name: z.string() }),
    posts: z.array(z.object({ id: z.string(), title: z.string() })),
    metadata: z.object({ total: z.number(), page: z.number() }),
  })
  const response = await client.get('/nested').contract(schema)

  expect(response.data.user.name).toBe('Alice')
  expect(response.data.posts).toHaveLength(2)
  expectTypeOf(response.data).toEqualTypeOf<{
    user: { id: string; name: string }
    posts: { id: string; title: string }[]
    metadata: { total: number; page: number }
  }>()
})

it('validates union types', async () => {
  server.use(
    http.get('https://api.example.com/union', () => {
      return HttpResponse.json({ type: 'success', value: 'OK' })
    })
  )

  const schema = z.union([
    z.object({ type: z.literal('success'), value: z.string() }),
    z.object({ type: z.literal('error'), message: z.string() }),
  ])
  const response = await client.get('/union').contract(schema)

  expect(response.data.type).toBe('success')
  expectTypeOf(response.data).toEqualTypeOf<
    { type: 'success'; value: string } | { type: 'error'; message: string }
  >()
})

it('validates discriminated unions', async () => {
  server.use(
    http.get('https://api.example.com/discriminated', () => {
      return HttpResponse.json({
        status: 'error',
        code: 500,
        message: 'Server Error',
      })
    })
  )

  const schema = z.discriminatedUnion('status', [
    z.object({ status: z.literal('success'), data: z.unknown() }),
    z.object({
      status: z.literal('error'),
      code: z.number(),
      message: z.string(),
    }),
  ])
  const response = await client.get('/discriminated').contract(schema)

  expect(response.data.status).toBe('error')
  if (response.data.status === 'error') {
    expect(response.data.code).toBe(500)
  }
  expectTypeOf(response.data).toEqualTypeOf<
    | { status: 'success'; data: unknown }
    | { status: 'error'; code: number; message: string }
  >()
})
