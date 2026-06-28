import { expect, it, vi } from 'vitest'
import { createHttpClient } from '../client'

let client: ReturnType<typeof createHttpClient>

beforeEach(() => {
  client = createHttpClient({ baseUrl: 'https://api.example.com' })
})

it('works when variable in middle of path', async () => {
  const response = await client.get('/users/:id/posts', {
    pathParams: { id: 1 },
  })
  expect(response.url).toBe('https://api.example.com/users/1/posts')
})

it('works when bare relative path starts with a variable', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  )
  const relativeClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: fetchMock as typeof fetch,
  })

  const response = await relativeClient.get(':id/users', {
    pathParams: { id: 1 },
  })

  expect(response.url).toBe('https://api.example.com/1/users')
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.example.com/1/users',
    expect.any(Object)
  )
})

it('works when no variables present', async () => {
  const response = await client.get('/users')
  expect(response.url).toBe('https://api.example.com/users')
})

it('omits optional path params when they are not provided', async () => {
  const response = await client.get('/users/:id?')

  expect(response.url).toBe('https://api.example.com/users')
})

it('uses optional path params when they are provided', async () => {
  const response = await client.get('/users/:id?', {
    pathParams: { id: 1 },
  })

  expect(response.url).toBe('https://api.example.com/users/1')
})

it('should handle URLs with query strings correctly', async () => {
  const response = await client.get('/users/:id', {
    pathParams: { id: 1 },
    params: { page: 1, limit: 10 },
  })

  expect(response.url).toBe('https://api.example.com/users/1?page=1&limit=10')
})

it('encodes reserved characters in path params', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  )

  const relativeClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    fetch: fetchMock as typeof fetch,
  })

  await relativeClient.get('/users/:id', {
    pathParams: { id: 'user /?#%' },
  })

  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.example.com/users/user%20%2F%3F%23%25',
    expect.any(Object)
  )
})

it('should reject on invalid path params', async () => {
  const requiredPath: string = '/users/:id'
  const nestedRequiredPath: string = '/users/:id/posts/:postId'

  await expect(client.request(requiredPath)).rejects.toThrow(
    'Missing required path parameter: "id"'
  )

  await expect(
    client.request(nestedRequiredPath, {
      pathParams: { id: 1 } as any,
    })
  ).rejects.toThrow('Missing required path parameter: "postId"')
})

it('rejects non-trailing optional path params for dynamic paths', async () => {
  const unsupportedPath: string = '/users/:id?/cards/:cardId'

  await expect(
    client.request(unsupportedPath, {
      method: 'GET',
      pathParams: { cardId: 1 } as any,
    })
  ).rejects.toThrow(
    'Optional path parameter "id" is not supported here. Optional path parameters are only supported at the end of the path.'
  )
})
