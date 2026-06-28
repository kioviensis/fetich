import { expectTypeOf } from 'expect-type'
import { expect, it } from 'vitest'
import { PathParams, generatePath } from './path'

it('generates path without parameters', () => {
  const result = generatePath('/users')
  expect(result).toBe('/users')
})

it('generates path with single parameter', () => {
  const result = generatePath('/users/:id', { id: '1' })
  expect(result).toBe('/users/1')
})

it('generates bare relative path that starts with a parameter', () => {
  const result = generatePath(':id/users', { id: '1' })
  expect(result).toBe('1/users')
})

it('handles numeric parameters', () => {
  const result = generatePath('/users/:id', { id: 1 })
  expect(result).toBe('/users/1')
})

it('generates path with multiple parameters', () => {
  const result = generatePath(
    '/users/:userId/posts/:postId/comments/:commentId',
    {
      userId: 1,
      postId: '2',
      commentId: '3',
    }
  )
  expect(result).toBe('/users/1/posts/2/comments/3')
})

it('throws error for missing required parameter', () => {
  expect(() => {
    generatePath('/users/:id', {} as any)
  }).toThrow('Missing required path parameter: "id"')
})

it('throws error for undefined parameter', () => {
  expect(() => {
    generatePath('/users/:id', { id: undefined as any })
  }).toThrow('Missing required path parameter: "id"')
})

it('handles parameters with underscores', () => {
  const result = generatePath('/users/:user_id', { user_id: '123' })
  expect(result).toBe('/users/123')
})

it('handles parameters with numbers', () => {
  const result = generatePath('/users/:user1', { user1: '123' })
  expect(result).toBe('/users/123')
})

it('handles empty path', () => {
  const result = generatePath('')
  expect(result).toBe('')
})

describe('PathParams', () => {
  it('infers path parameters when query strings contain equals', () => {
    expectTypeOf<PathParams<'/users/:id?x=1'>>().toEqualTypeOf<{
      id: string | number
    }>()
  })

  it('infers path parameters when query strings contain ampersands', () => {
    expectTypeOf<PathParams<'/users/:id?param1&param2'>>().toEqualTypeOf<{
      id: string | number
    }>()
  })

  it('infers path parameters when query strings have mixed formats', () => {
    expectTypeOf<PathParams<'/users/:id?search=test&page=1'>>().toEqualTypeOf<{
      id: string | number
    }>()
  })

  it('infers path parameters when query strings have parameters without values', () => {
    expectTypeOf<PathParams<'/users/:id?flag&search=test'>>().toEqualTypeOf<{
      id: string | number
    }>()
  })

  it('infers path parameters when query strings have empty values', () => {
    expectTypeOf<PathParams<'/users/:id?empty=&filled=value'>>().toEqualTypeOf<{
      id: string | number
    }>()
  })

  it('infers path parameters when query strings have multiple parameters', () => {
    expectTypeOf<
      PathParams<'/users/:id?search=test&page=1&sort=name'>
    >().toEqualTypeOf<{ id: string | number }>()
  })

  it('preserves question marks that are part of optional path parameters', () => {
    expectTypeOf<PathParams<'/users/:id?'>>().toEqualTypeOf<{
      id?: string | number
    }>()
  })

  it('infers path parameters from paths without query strings', () => {
    expectTypeOf<PathParams<'/users/:id'>>().toEqualTypeOf<{
      id: string | number
    }>()
  })

  it('infers path parameters from bare relative paths that start with params', () => {
    expectTypeOf<PathParams<':id/users'>>().toEqualTypeOf<{
      id: string | number
    }>()
  })

  it('infers path parameters from bare relative paths with params later', () => {
    expectTypeOf<PathParams<'users/:id'>>().toEqualTypeOf<{
      id: string | number
    }>()
  })

  it('infers path parameters from full URLs', () => {
    expectTypeOf<
      PathParams<'https://api.example.com/users/:id'>
    >().toEqualTypeOf<{
      id: string | number
    }>()
  })

  it('infers multiple path parameters when query strings are present', () => {
    expectTypeOf<
      PathParams<'/users/:id/posts/:postId?sort=date'>
    >().toEqualTypeOf<{ id: string | number; postId: string | number }>()
  })

  it('infers single optional path parameter', () => {
    expectTypeOf<PathParams<'/posts/:postId?'>>().toEqualTypeOf<{
      postId?: string | number
    }>()
  })

  it('infers two required path parameters', () => {
    expectTypeOf<PathParams<'/users/:id/posts/:postId'>>().toEqualTypeOf<{
      id: string | number
      postId: string | number
    }>()
  })

  it('infers mixed required and optional path parameters', () => {
    expectTypeOf<PathParams<'/users/:id/posts/:postId?'>>().toEqualTypeOf<{
      id: string | number
      postId?: string | number
    }>()
  })

  it('rejects non-trailing optional path parameters', () => {
    expectTypeOf<
      PathParams<'/users/:id?/posts/:postId?'>
    >().toEqualTypeOf<never>()
  })
})

it('validates parameter names', () => {
  expect(() => generatePath('/users/:id', { id: '123' })).not.toThrow()
  expect(() => generatePath('/users/:userId', { userId: '123' })).not.toThrow()
  expect(() => generatePath('/users/:user_1', { user_1: '123' })).not.toThrow()
  expect(() =>
    generatePath('/users/:user123', { user123: '123' })
  ).not.toThrow()

  expect(() => generatePath('/users/:id-1', { 'id-1': '123' })).toThrow(
    'Invalid path parameter name'
  )
  expect(() => generatePath('/users/:id.1', { 'id.1': '123' })).toThrow(
    'Invalid path parameter name'
  )
  expect(() => generatePath('/users/:id@', { 'id@': '123' })).toThrow(
    'Invalid path parameter name'
  )

  expect(() => generatePath('/users/:id#', { id: '123' } as any)).not.toThrow()
})

it('validates parameter values correctly', () => {
  expect(generatePath('/users/:id', { id: '123' })).toBe('/users/123')
  expect(generatePath('/users/:id', { id: 123 })).toBe('/users/123')
  expect(generatePath('/users/:id', { id: 'alice' })).toBe('/users/alice')
  expect(generatePath('/users/:id', { id: 'user_123' })).toBe('/users/user_123')
  expect(generatePath('/users/:id', { id: '123/456' })).toBe('/users/123%2F456')
  expect(generatePath('/users/:id', { id: '123?x=1' })).toBe(
    '/users/123%3Fx%3D1'
  )
  expect(generatePath('/users/:id', { id: '123#section' })).toBe(
    '/users/123%23section'
  )
  expect(generatePath('/users/:id', { id: '123@domain.com' })).toBe(
    '/users/123%40domain.com'
  )
})

it('handles optional parameters correctly', () => {
  expect(generatePath('/users/:id?', { id: '123' })).toBe('/users/123')
  expect(generatePath('/users/:id?', {} as any)).toBe('/users')
})

it('rejects non-trailing optional path parameters at runtime', () => {
  const unsupportedPath: string = '/users/:id?/posts/:postId?'

  expect(() =>
    generatePath(unsupportedPath, {
      id: '123',
      postId: '456',
    } as any)
  ).toThrow(
    'Optional path parameter "id" is not supported here. Optional path parameters are only supported at the end of the path.'
  )
})

it('validates missing parameters correctly', () => {
  expect(() => generatePath('/users/:id', {} as any)).toThrow(
    'Missing required path parameter: "id"'
  )
  expect(() => generatePath('/users/:id', { id: undefined as any })).toThrow(
    'Missing required path parameter: "id"'
  )
  expect(() =>
    generatePath('/users/:id/posts/:postId', { id: '123' } as any)
  ).toThrow('Missing required path parameter: "postId"')
})

it('validates complex path structures', () => {
  expect(() =>
    generatePath('/api/:version/users/:id/posts/:postId', {
      version: 'v1',
      id: '123',
      postId: '456',
    })
  ).not.toThrow()

  expect(() =>
    generatePath('/api/:version/users/:id/posts/:postId', {
      version: 'v1',
      id: '123/456',
      postId: '456',
    })
  ).not.toThrow()

  expect(() =>
    generatePath('/api/:version/users/:id/posts/:postId', {
      version: 'v1',
      id: '123',
      postId: '456?x=1',
    })
  ).not.toThrow()
})

it('handles edge cases with special characters', () => {
  expect(generatePath('/users/:id', { id: 'user@domain.com' })).toBe(
    '/users/user%40domain.com'
  )
  expect(generatePath('/users/:id', { id: 'user#123' })).toBe(
    '/users/user%23123'
  )
  expect(generatePath('/users/:id', { id: 'user+123' })).toBe(
    '/users/user%2B123'
  )
  expect(generatePath('/users/:id', { id: 'user-123' })).toBe('/users/user-123')
  expect(generatePath('/users/:id', { id: 'user/123' })).toBe(
    '/users/user%2F123'
  )
  expect(generatePath('/users/:id', { id: 'user?x=1' })).toBe(
    '/users/user%3Fx%3D1'
  )
})

it('validates parameter name extraction from malformed paths', () => {
  expect(() => generatePath('/users/:id-1', { 'id-1': '123' })).toThrow(
    'Invalid path parameter name'
  )
  expect(() => generatePath('/users/:id.1', { 'id.1': '123' })).toThrow(
    'Invalid path parameter name'
  )
  expect(() => generatePath('/users/:id@', { 'id@': '123' })).toThrow(
    'Invalid path parameter name'
  )
})
