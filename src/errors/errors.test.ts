import { expect, it } from 'vitest'
import { z } from 'zod'
import {
  AbortError,
  AsyncSchemaValidationError,
  ContractValidationError,
  HttpError,
  InvalidBaseUrlError,
  InvalidContractError,
  InvalidSchemaError,
  MiddlewareError,
  NetworkError,
  PathParameterError,
  SchemaValidationError,
  SerializationError,
  TimeoutError,
} from './errors'

it('HttpError creates error with clean message and request details', () => {
  const mockResponse = new Response('{"error": "Not found"}', {
    status: 404,
    statusText: 'Not Found',
  })

  const error = new HttpError(
    'Resource not found',
    404,
    'Not Found',
    { error: 'Not found' },
    mockResponse,
    'https://api.example.com/users/123',
    'GET'
  )

  expect(error.message).toBe(
    'HTTP Client Error (404): Resource not found\nRequest: GET https://api.example.com/users/123\nData: {"error":"Not found"}'
  )
  expect(error.status).toBe(404)
  expect(error.statusText).toBe('Not Found')
  expect(error.url).toBe('https://api.example.com/users/123')
  expect(error.method).toBe('GET')
})

it('HttpError truncates long data in error message', () => {
  const longData = { message: 'x'.repeat(1000) }
  const mockResponse = new Response(JSON.stringify(longData), {
    status: 500,
    statusText: 'Internal Server Error',
  })

  const error = new HttpError(
    'Server error',
    500,
    'Internal Server Error',
    longData,
    mockResponse,
    'https://api.example.com/test',
    'POST'
  )

  const truncatedData = JSON.stringify(longData).substring(0, 500) + '...'
  expect(error.message).toBe(
    `HTTP Server Error (500): Server error\nRequest: POST https://api.example.com/test\nData: ${truncatedData}`
  )
})

it('HttpError categorizes status codes correctly', () => {
  const mockResponse = new Response('', { status: 200, statusText: 'OK' })

  const successError = new HttpError(
    'User profile retrieved successfully',
    200,
    'OK',
    null,
    mockResponse,
    'https://api.example.com',
    'GET'
  )
  expect(successError.message).toBe(
    'HTTP Success (200): User profile retrieved successfully\nRequest: GET https://api.example.com\nData: No response data'
  )

  const redirectError = new HttpError(
    'API endpoint has moved to new location',
    301,
    'Moved Permanently',
    null,
    mockResponse,
    'https://api.example.com',
    'GET'
  )
  expect(redirectError.message).toBe(
    'HTTP Redirect (301): API endpoint has moved to new location\nRequest: GET https://api.example.com\nData: No response data'
  )

  const clientError = new HttpError(
    'Missing required authentication token',
    400,
    'Bad Request',
    null,
    mockResponse,
    'https://api.example.com',
    'GET'
  )
  expect(clientError.message).toBe(
    'HTTP Client Error (400): Missing required authentication token\nRequest: GET https://api.example.com\nData: No response data'
  )

  const serverError = new HttpError(
    'Database connection timeout',
    500,
    'Internal Server Error',
    null,
    mockResponse,
    'https://api.example.com',
    'GET'
  )
  expect(serverError.message).toBe(
    'HTTP Server Error (500): Database connection timeout\nRequest: GET https://api.example.com\nData: No response data'
  )
})

it('NetworkError creates error with clean message', () => {
  const cause = new Error('Connection failed')
  const error = new NetworkError('Failed to connect to server', cause)

  expect(error.message).toBe('Failed to connect to server')
  expect(error.name).toBe('NetworkError')
})

it('SchemaValidationError creates error with clean message', () => {
  const schema = z.string()
  const data = 123
  const cause = new Error('Validation failed')

  const error = new SchemaValidationError(
    'Invalid data type',
    schema,
    data,
    cause
  )

  expect(error.message).toBe('Invalid data type')
  expect(error.schema).toBe(schema)
  expect(error.data).toBe(data)
  expect(error.name).toBe('SchemaValidationError')
})

it('ContractValidationError preserves response context', () => {
  const schema = z.object({ code: z.string() })
  const data = { message: 'Bad request' }
  const raw = new Response(JSON.stringify(data), {
    status: 400,
    statusText: 'Bad Request',
  })
  const cause = new Error('Expected code')

  const error = new ContractValidationError(
    'Error response failed contract validation: Expected code',
    schema,
    data,
    {
      status: 400,
      statusText: 'Bad Request',
      raw,
      url: 'https://api.example.com/transactions',
      method: 'POST',
    },
    'error',
    cause
  )

  expect(error).toBeInstanceOf(SchemaValidationError)
  expect(error.message).toBe(
    'Error response failed contract validation: Expected code\nRequest: POST https://api.example.com/transactions\nStatus: 400 Bad Request'
  )
  expect(error.name).toBe('ContractValidationError')
  expect(error.branch).toBe('error')
  expect(error.status).toBe(400)
  expect(error.statusText).toBe('Bad Request')
  expect(error.response).toBe(raw)
  expect(error.url).toBe('https://api.example.com/transactions')
  expect(error.method).toBe('POST')
  expect(error.cause).toBe(cause)
})

it('TimeoutError creates error with clean message', () => {
  const error = new TimeoutError('Request timed out after 5000ms')

  expect(error.message).toBe('Request timed out after 5000ms')
  expect(error.name).toBe('TimeoutError')
})

it('AbortError creates error with clean message', () => {
  const cause = new Error('Request aborted by caller')
  const error = new AbortError('Request aborted by caller', cause)

  expect(error.message).toBe('Request aborted by caller')
  expect(error.name).toBe('AbortError')
  expect(error.cause).toBe(cause)
})

it('PathParameterError creates error with clean message', () => {
  const error = new PathParameterError(
    'Missing required path parameter: "id"',
    '/users/:id',
    ['id'],
    ['userId']
  )

  expect(error.message).toBe(
    'Missing required path parameter: "id"\nURL Template: /users/:id\nExpected: ["id"], Actual: ["userId"]'
  )
  expect(error.url).toBe('/users/:id')
  expect(error.requiredParams).toEqual(['id'])
  expect(error.providedParams).toEqual(['userId'])
  expect(error.name).toBe('PathParameterError')
})

it('MiddlewareError creates error with clean message and request info', () => {
  const error = new MiddlewareError(
    'Failed to process request',
    'request',
    'https://api.example.com/users',
    'GET'
  )

  expect(error.message).toBe(
    'Failed to process request\nRequest: GET https://api.example.com/users'
  )
  expect(error.type).toBe('request')
  expect(error.url).toBe('https://api.example.com/users')
  expect(error.method).toBe('GET')
  expect(error.name).toBe('MiddlewareError')
})

it('MiddlewareError creates error without request info when URL not provided', () => {
  const error = new MiddlewareError('Failed to process response', 'response')

  expect(error.message).toBe('Failed to process response')
  expect(error.type).toBe('response')
  expect(error.url).toBeUndefined()
  expect(error.method).toBeUndefined()
})

it('MiddlewareError handles unknown method', () => {
  const error = new MiddlewareError(
    'Failed to process request',
    'request',
    'https://api.example.com/users'
  )

  expect(error.message).toBe(
    'Failed to process request\nRequest: UNKNOWN https://api.example.com/users'
  )
  expect(error.method).toBeUndefined()
})

it('SerializationError creates error with clean message', () => {
  const cause = new Error('JSON.stringify failed')
  const error = new SerializationError(
    'Failed to serialize request body',
    cause
  )

  expect(error.message).toBe('Failed to serialize request body')
  expect(error.name).toBe('SerializationError')
})

it('InvalidSchemaError creates error with clean message', () => {
  const schema = 'not a schema'
  const cause = new Error('Invalid schema type')

  const error = new InvalidSchemaError(
    'Schema must be a Zod schema',
    schema,
    cause
  )

  expect(error.message).toBe('Schema must be a Zod schema')
  expect(error.schema).toBe(schema)
  expect(error.name).toBe('InvalidSchemaError')
})

it('InvalidContractError creates error with contract context', () => {
  const contract = { success: {} }
  const cause = new Error('Missing default')

  const error = new InvalidContractError(
    'No success response contract found for status 202',
    contract,
    202,
    'success',
    cause
  )

  expect(error.message).toBe(
    'No success response contract found for status 202'
  )
  expect(error.contract).toBe(contract)
  expect(error.status).toBe(202)
  expect(error.branch).toBe('success')
  expect(error.cause).toBe(cause)
  expect(error.name).toBe('InvalidContractError')
})

it('AsyncSchemaValidationError creates error with clean message', () => {
  const schema = z.string()
  const cause = new Error('Async validation failed')

  const error = new AsyncSchemaValidationError(
    'Async validation failed',
    schema,
    cause
  )

  expect(error.message).toBe('Async validation failed')
  expect(error.schema).toBe(schema)
  expect(error.name).toBe('AsyncSchemaValidationError')
})

it('InvalidBaseUrlError creates error with clean message and base URL', () => {
  const error = new InvalidBaseUrlError('URL must be absolute', 'relative/path')

  expect(error.message).toBe('URL must be absolute\nBase URL: relative/path')
  expect(error.baseUrl).toBe('relative/path')
  expect(error.name).toBe('InvalidBaseUrlError')
})
