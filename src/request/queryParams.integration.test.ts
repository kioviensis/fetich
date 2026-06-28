import { expect, it } from 'vitest'
import { createHttpClient } from '../client'

let client: ReturnType<typeof createHttpClient>

beforeEach(() => {
  client = createHttpClient({
    baseUrl: 'https://api.example.com',
  })
})

it('serializes string arrays as multiple parameters', async () => {
  const response = await client.get('/users', {
    params: {
      tags: ['javascript', 'typescript', 'react'],
    },
  })

  expect(response.url).toBe(
    'https://api.example.com/users?tags=javascript&tags=typescript&tags=react'
  )
})

it('handles mixed array types with strings and numbers', async () => {
  const response = await client.get('/users', {
    params: {
      categories: ['tech', 'web'],
      ids: [1, 2, 3],
    },
  })

  expect(response.url).toBe(
    'https://api.example.com/users?categories=tech&categories=web&ids=1&ids=2&ids=3'
  )
})

it('skips undefined values in arrays', async () => {
  const response = await client.get('/users', {
    params: {
      tags: ['active', undefined, 'inactive'],
    },
  })

  expect(response.url).toBe(
    'https://api.example.com/users?tags=active&tags=inactive'
  )
})

it('skips null values in arrays', async () => {
  const response = await client.get('/users', {
    params: {
      tags: ['active', null, 'inactive'],
    },
  })

  expect(response.url).toBe(
    'https://api.example.com/users?tags=active&tags=inactive'
  )
})

it('skips both undefined and null values in arrays', async () => {
  const response = await client.get('/users', {
    params: {
      tags: ['active', undefined, null, 'inactive'],
    },
  })

  expect(response.url).toBe(
    'https://api.example.com/users?tags=active&tags=inactive'
  )
})

it('converts numbers to strings', async () => {
  const response = await client.get('/users', {
    params: {
      page: 1,
      limit: 10,
    },
  })

  expect(response.url).toBe('https://api.example.com/users?page=1&limit=10')
})

it('handles boolean params', async () => {
  const response = await client.get('/users', {
    params: {
      active: true,
      verified: false,
    },
  })

  expect(response.url).toBe(
    'https://api.example.com/users?active=true&verified=false'
  )
})

it('handles string params', async () => {
  const response = await client.get('/users', {
    params: {
      name: 'John Doe',
      email: 'john@example.com',
    },
  })

  expect(response.url).toBe(
    'https://api.example.com/users?name=John+Doe&email=john%40example.com'
  )
})

it('omits undefined values from query string', async () => {
  const response = await client.get('/users', {
    params: {
      name: 'John',
      age: undefined,
      email: 'john@example.com',
    },
  })

  expect(response.url).toBe(
    'https://api.example.com/users?name=John&email=john%40example.com'
  )
})

it('omits null values from query string', async () => {
  const response = await client.get('/users', {
    params: {
      name: 'John',
      age: null,
      email: 'john@example.com',
    },
  })

  expect(response.url).toBe(
    'https://api.example.com/users?name=John&email=john%40example.com'
  )
})

it('handles all undefined values', async () => {
  const response = await client.get('/users', {
    params: {
      name: undefined,
      age: undefined,
    },
  })

  expect(response.url).toBe('https://api.example.com/users')
})

it('handles all null values', async () => {
  const response = await client.get('/users', {
    params: {
      name: null,
      age: null,
    },
  })

  expect(response.url).toBe('https://api.example.com/users')
})

it('handles complex parameter combinations with mixed types', async () => {
  const response = await client.get('/users', {
    params: {
      name: 'John',
      age: 30,
      active: true,
      tags: ['developer', 'typescript'],
      skills: ['javascript', 'react'],
      metadata: undefined,
      q: 'hello & goodbye',
      filter: 'price < 100',
    },
  })

  expect(response.url).toBe(
    'https://api.example.com/users?name=John&age=30&active=true&tags=developer&tags=typescript&skills=javascript&skills=react&q=hello+%26+goodbye&filter=price+%3C+100'
  )
})

it('handles empty object', async () => {
  const response = await client.get('/users', {
    params: {},
  })

  expect(response.url).toBe('https://api.example.com/users')
})

it('handles empty arrays', async () => {
  const response = await client.get('/users', {
    params: {
      tags: [],
      categories: [],
    },
  })

  expect(response.url).toBe('https://api.example.com/users')
})

it('uses custom serializer when provided', async () => {
  const customClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    serializeParams: params => {
      return Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join(',')
    },
  })

  const response = await customClient.get('/users', {
    params: {
      name: 'John',
      age: 30,
    },
  })

  expect(response.url).toBe('https://api.example.com/users?name=John,age=30')
})

it('handles custom serializer returning query string with question mark', async () => {
  const customClient = createHttpClient({
    baseUrl: 'https://api.example.com',
    serializeParams: params => {
      return `?${Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&')}`
    },
  })

  const response = await customClient.get('/users', {
    params: {
      name: 'John',
      age: 30,
    },
  })

  expect(response.url).toBe('https://api.example.com/users?name=John&age=30')
})
