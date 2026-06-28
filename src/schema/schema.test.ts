import type { StandardSchemaV1 } from '@standard-schema/spec'
import { http, HttpResponse } from 'msw'
import { expect, it, vi } from 'vitest'
import { z } from 'zod'

import { createHttpClient } from '../client'
import { InvalidSchemaError, SchemaValidationError } from '../errors'
import { createSchemaValidator, type SchemaValidator } from '.'
import { server } from '../testing/setup'

it('should create a validator that supports Standard Schema', () => {
  const validator = createSchemaValidator()

  expect(validator).toBeDefined()
  expect(typeof validator.validate).toBe('function')
})

it('should validate data with Standard Schema', () => {
  const userSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email(),
  })

  const validator = createSchemaValidator()
  const testData = { id: 1, name: 'John', email: 'john@example.com' }

  const result = validator.validate(userSchema, testData)
  expect(result).toEqual(testData)
})

it('should validate data with async Standard Schema validators', async () => {
  const validator = createSchemaValidator()
  const asyncSchema = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: async (value: unknown) => ({
        value: String(value),
      }),
    },
  } satisfies StandardSchemaV1<unknown, string>

  await expect(
    Promise.resolve(validator.validate(asyncSchema, 'hello'))
  ).resolves.toBe('hello')
})

it('should validate data with promise-like Standard Schema validators', async () => {
  const validator = createSchemaValidator()
  const thenableSchema = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value: unknown) => ({
        then: (resolve: (result: StandardSchemaV1.Result<string>) => void) => {
          resolve({ value: String(value) })
        },
      }),
    },
  } as unknown as StandardSchemaV1<unknown, string>

  await expect(
    Promise.resolve(validator.validate(thenableSchema, 'hello'))
  ).resolves.toBe('hello')
})

it('should throw error for non-Standard Schema', () => {
  const validator = createSchemaValidator()
  const nonStandardSchema = { someProperty: 'not a standard schema' }

  expect(() => {
    validator.validate(nonStandardSchema as never, {})
  }).toThrow('Schema must implement the Standard Schema interface')
})

it('should reject non-v1 Standard Schema versions', () => {
  const validator = createSchemaValidator()
  const futureSchema = {
    '~standard': {
      version: 2,
      vendor: 'future',
      validate: (value: unknown) => ({ value }),
    },
  } as unknown as StandardSchemaV1

  expect(() => {
    validator.validate(futureSchema, {})
  }).toThrow(InvalidSchemaError)
})

it('should expose structured Standard Schema issues on validation errors', () => {
  const validator = createSchemaValidator()
  const issues: ReadonlyArray<StandardSchemaV1.Issue> = [
    { message: 'Expected string', path: ['name'] },
  ]
  const failingSchema = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: () => ({ issues }),
    },
  } satisfies StandardSchemaV1<unknown, string>

  const error = (() => {
    try {
      validator.validate(failingSchema, { name: 123 })
    } catch (cause) {
      return cause
    }
  })()

  expect(error).toBeInstanceOf(SchemaValidationError)
  expect(error).toMatchObject({ issues })
})

it('allows setting custom schema validator via constructor', async () => {
  const customValidator: SchemaValidator = {
    validate: vi.fn().mockImplementation((schema, data) => {
      if (data.status === 'error') {
        throw new SchemaValidationError(
          'Custom validation failed',
          schema,
          data
        )
      }
      return data
    }),
  }

  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
    schemaValidator: customValidator,
  })

  server.use(
    http.get('https://api.example.com/users', async () => {
      return HttpResponse.json({ status: 'error' })
    })
  )

  const schema = z.object({ status: z.string() })

  await expect(client.get('/users').contract(schema)).rejects.toThrow(
    'Custom validation failed'
  )

  expect(customValidator.validate).toHaveBeenCalledWith(schema, {
    status: 'error',
  })
})

it('uses default validator when none provided', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.get('https://api.example.com/users', async () => {
      return HttpResponse.json({
        id: 1,
        name: 'John',
        email: 'john@example.com',
      })
    })
  )

  const testSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email(),
  })

  const response = await client.get('/users').contract(testSchema)
  expect(response.data).toEqual({
    id: 1,
    name: 'John',
    email: 'john@example.com',
  })
})

it('supports async contract validation in client requests', async () => {
  const client = createHttpClient({
    baseUrl: 'https://api.example.com',
    timeout: 1_000,
  })

  server.use(
    http.get('https://api.example.com/users', async () => {
      return HttpResponse.json({
        id: 1,
        name: 'John',
        email: 'john@example.com',
      })
    })
  )

  const asyncSchema = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: async (value: unknown) => ({
        value,
      }),
    },
  } satisfies StandardSchemaV1<unknown, unknown>

  const response = await client.get('/users').contract(asyncSchema)
  expect(response.data).toEqual({
    id: 1,
    name: 'John',
    email: 'john@example.com',
  })
})
