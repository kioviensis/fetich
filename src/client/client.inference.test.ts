import type { StandardSchemaV1 } from '@standard-schema/spec'
import { expectTypeOf } from 'expect-type'
import { expect, it } from 'vitest'
import { z } from 'zod'

import { createHttpClient } from '.'
import { ResponseType } from '../types'

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.email(),
})

it('should infer User type from schema on all HTTP methods', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  // GET request
  const getResponse = await client
    .get('/users/:id', {
      pathParams: { id: 1 },
    })
    .contract(userSchema)
  expectTypeOf(getResponse).toEqualTypeOf<
    ResponseType<z.infer<typeof userSchema>>
  >()

  // POST request
  const newUser = { name: 'Alice', email: 'alice@example.com' }
  const postResponse = await client.post('/users', newUser).contract(userSchema)
  expectTypeOf(postResponse).toEqualTypeOf<
    ResponseType<z.infer<typeof userSchema>>
  >()

  // PUT request
  const updatedUser = { name: 'Updated John', email: 'john@example.com' }
  const putResponse = await client
    .put('/users/:id', updatedUser, {
      pathParams: { id: '1' },
    })
    .contract(userSchema)
  expectTypeOf(putResponse).toEqualTypeOf<
    ResponseType<z.infer<typeof userSchema>>
  >()

  // PATCH request
  const partialUpdate = { name: 'John Updated' }
  const patchResponse = await client
    .patch('/users/:id', partialUpdate, {
      pathParams: { id: '1' },
    })
    .contract(userSchema)
  expectTypeOf(patchResponse).toEqualTypeOf<
    ResponseType<z.infer<typeof userSchema>>
  >()

  // DELETE request
  const deleteResponseSchema = z.object({ success: z.boolean() })
  const deleteResponse = await client
    .delete('/users/:id', {
      pathParams: { id: '1' },
    })
    .contract(deleteResponseSchema)
  expectTypeOf(deleteResponse).toEqualTypeOf<
    ResponseType<z.infer<typeof deleteResponseSchema>>
  >()
})

it('defaults to unknown type when no schema provided', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  const getResponse = await client.get('/users/:id', {
    pathParams: { id: '1' },
  })
  expectTypeOf(getResponse).toEqualTypeOf<ResponseType<unknown>>()

  const newUser = { name: 'Alice', email: 'alice@example.com' }
  const postResponse = await client.post('/users', newUser)
  expectTypeOf(postResponse).toEqualTypeOf<ResponseType<unknown>>()
})

it('infers branded Zod schema output', async () => {
  const userNameSchema = z.string().brand<'UserName'>()
  const brandedUserSchema = z.object({
    id: z.string(),
    username: userNameSchema,
  })
  type BrandedUser = z.infer<typeof brandedUserSchema>

  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async () =>
      new Response(JSON.stringify({ id: '123', username: 'johndoe' }), {
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch,
  })

  const response = await client
    .get('/users/:id', {
      pathParams: { id: '123' },
    })
    .contract(brandedUserSchema)

  expect(response.data).toEqual({ id: '123', username: 'johndoe' })
  expectTypeOf(response.data).toEqualTypeOf<BrandedUser>()
})

it('prefers parse return type for Standard Schema-compatible helpers', async () => {
  type UserName = string & { __brand: 'UserName' }
  type User = {
    id: string
    username: UserName
  }

  type StandardSchemaWithTypedParse<T> = StandardSchemaV1<unknown, unknown> & {
    parse(data: unknown): T
  }

  const typedUserSchema = z.object({
    id: z.string(),
    username: z.string(),
  }) as unknown as StandardSchemaWithTypedParse<User>

  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: (async () =>
      new Response(JSON.stringify({ id: '123', username: 'johndoe' }), {
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch,
  })

  const response = await client
    .get('/users/:id', {
      pathParams: { id: '123' },
    })
    .contract(typedUserSchema)

  expect(response.data).toEqual({ id: '123', username: 'johndoe' })
  expectTypeOf(response.data).toEqualTypeOf<User>()
})

it('prefers explicit _output metadata for custom Standard Schema inference', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  type UserWithSource = {
    id: number
    source: 'standard-schema'
  }

  const schema = {
    _output: undefined as unknown as UserWithSource,
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value: unknown) => ({
        value: {
          id: (value as { id: number }).id,
          source: 'standard-schema',
        } satisfies UserWithSource,
      }),
    },
  } satisfies StandardSchemaV1<unknown, UserWithSource> & {
    _output: UserWithSource
  }

  const response = await client
    .get('/users/:id', {
      pathParams: { id: '1' },
    })
    .contract(schema)

  expect(response.data).toEqual({ id: 1, source: 'standard-schema' })
  expectTypeOf(response.data).toEqualTypeOf<UserWithSource>()
})
