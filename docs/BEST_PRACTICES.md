# Best Practices Guide

This guide provides recommendations for using 1000fetches effectively in production applications.

## Table of Contents

- [Client Configuration](#client-configuration)
- [Dynamic Defaults](#dynamic-defaults)
- [Error Handling](#error-handling)
- [Schema Validation](#schema-validation)
- [Middleware](#middleware)
- [Performance Optimization](#performance-optimization)
- [Testing](#testing)
- [Security](#security)
- [Monitoring](#monitoring)

## Client Configuration

### ✅ DO: Create a Single Client Instance

Create one client instance per API and reuse it throughout your application.

```typescript
import { createHttpClient } from '1000fetches'

export const apiClient = createHttpClient({
  baseUrl: process.env.API_BASE_URL,
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'MyApp/1.0.0',
  },
  retry: {
    maxRetries: 3,
    retryDelay: 1_000,
    retryStatusCodes: [408, 429, 500, 502, 503, 504],
  },
})
```

### ✅ DO: Use Environment-Specific Configuration

```typescript
const config = {
  development: {
    baseUrl: 'http://localhost:3000/api',
    timeout: 30_000, // Longer timeout for development
  },
  production: {
    baseUrl: 'https://api.myapp.com',
    timeout: 10_000,
  },
}

const environment =
  process.env.NODE_ENV === 'production' ? 'production' : 'development'

export const apiClient = createHttpClient(config[environment])
```

### ❌ DON'T: Create Multiple Clients for the Same API

```typescript
// Bad: Creates unnecessary overhead
const userClient = createHttpClient({ baseUrl: 'https://api.example.com' })
const postClient = createHttpClient({ baseUrl: 'https://api.example.com' })

// Good: Use one client with different endpoints
const apiClient = createHttpClient({ baseUrl: 'https://api.example.com' })
```

## Dynamic Defaults

### ✅ DO: Use Defaults for Dynamic Auth and Request-Shaped Defaults

Use `defaults` when a value should be resolved for each request but does not need to mutate the final request context.

```typescript
const apiClient = createHttpClient({
  baseUrl: 'https://api.example.com',
  defaults: async ({ resolvedPath, method }) => {
    const token = await getAuthToken()

    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Client': 'web',
      },
      timeout: resolvedPath.startsWith('/reports') ? 60_000 : 10_000,
      retry: method === 'GET',
      params: {
        locale: 'en-US',
      },
    }
  },
})
```

### ✅ DO: Let Request Options Override Defaults

Request options are applied after dynamic defaults, so callers can opt out or specialize one request without creating another client.

```typescript
const apiClient = createHttpClient({
  baseUrl: 'https://api.example.com',
  defaults: () => ({
    headers: { 'X-Client': 'web' },
    timeout: 10_000,
    retry: true,
  }),
})

await apiClient.get('/health', {
  timeout: 2_000,
  retry: false,
  headers: { 'X-Client': 'health-check' },
})
```

## Error Handling

### ✅ DO: Handle Specific Error Types

```typescript
import {
  AbortError,
  HttpError,
  NetworkError,
  TimeoutError,
  SchemaValidationError,
} from '1000fetches'

async function fetchUser(id: string) {
  try {
    return await apiClient.get(`/users/${id}`)
  } catch (error) {
    if (error instanceof HttpError) {
      switch (error.status) {
        case 404:
          throw new UserNotFoundError(`User ${id} not found`)
        case 403:
          throw new UnauthorizedError('Access denied')
        default:
          throw new ApiError(`API error: ${error.status}`)
      }
    } else if (error instanceof NetworkError) {
      throw new ConnectivityError('Network connection failed')
    } else if (error instanceof TimeoutError) {
      throw new TimeoutError('Request timed out')
    } else if (error instanceof AbortError) {
      throw error
    } else {
      throw error
    }
  }
}
```

### ✅ DO: Implement Retry Logic for Idempotent Operations

```typescript
// Good: Retry safe operations
const user = await apiClient.get('/users/1', {
  retry: {
    maxRetries: 3,
    retryDelay: 1_000,
  },
})

// Be careful: Only retry idempotent operations
const newUser = await apiClient.post('/users', userData, {
  retry: false,
})
```

### ✅ DO: Declare Valid Non-2xx Statuses Explicitly

The default success rule is any 2xx status. Use a response contract status map when the protocol intentionally uses another status, such as conditional requests that return `304 Not Modified`.

```typescript
const response = await apiClient
  .get('/reports/:id', {
    pathParams: { id: reportId },
  })
  .contract({
    success: {
      default: ReportSchema,
      304: z.undefined(),
    },
  })

if (response.status === 304) {
  return cachedReport
}
```

## Schema Validation

### ✅ DO: Validate Response Data

```typescript
import { z } from 'zod'

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  age: z.number().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

await apiClient.get(`/users/${id}`).contract(userSchema)
```

### ✅ DO: Create Reusable Schema Compositions

```typescript
const BaseEntitySchema = z.object({
  id: z.number(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

const UserSchema = BaseEntitySchema.extend({
  name: z.string(),
  email: z.email(),
})

const PostSchema = BaseEntitySchema.extend({
  title: z.string(),
  content: z.string(),
  authorId: z.number(),
})
```

## Middleware

### ✅ DO: Use Middleware for Observation and Deliberate Mutation

```typescript
const apiClient = createHttpClient({
  baseUrl: 'https://api.example.com',
  onRequestMiddleware: context => {
    console.log(`→ ${context.method} ${context.url}`)
    return context
  },
  onResponseMiddleware: response => {
    console.log(`← ${response.status} ${response.method} ${response.url}`)
    return response
  },
})
```

Middleware can observe requests and responses, and it can mutate request/response state. Keep it side-effect-light; use mutation only when dynamic defaults or request options are not expressive enough.

### ✅ DO: Handle Middleware Errors Gracefully

```typescript
const apiClient = createHttpClient({
  baseUrl: 'https://api.example.com',
  onRequestMiddleware: async context => {
    try {
      context.headers.set('X-Request-ID', await createRequestId())
      return context
    } catch (error) {
      console.warn('Failed to create request id:', error)
      return context
    }
  },
})
```

### ✅ DO: Treat Response Status Rewrites as Explicit Recovery

Response middleware is authoritative. If it returns a different `status`, that changed status controls whether the request resolves or throws `HttpError`.

```typescript
const apiClient = createHttpClient({
  baseUrl: 'https://api.example.com',
  onResponseMiddleware: async response => {
    if (response.status === 404) {
      return {
        ...response,
        status: 200,
        statusText: 'Recovered Not Found',
        data: null,
      }
    }

    return response
  },
})
```

When you only want to normalize an error payload, keep the original status:

```typescript
const apiClient = createHttpClient({
  baseUrl: 'https://api.example.com',
  onResponseMiddleware: async response => {
    if (response.status >= 400) {
      return {
        ...response,
        data: normalizeApiError(response.data),
      }
    }

    return response
  },
})
```

### ❌ DON'T: Perform Heavy Operations in Middleware

```typescript
// Bad: Heavy computation in middleware
const apiClient = createHttpClient({
  onRequestMiddleware: async context => {
    const heavyResult = await performHeavyComputation() // Slows down all requests
    return context
  },
})

// Good: Keep middleware lightweight
const apiClient = createHttpClient({
  onRequestMiddleware: async context => {
    context.headers.set('X-Request-ID', generateRequestId()) // Fast operation
    return context
  },
})
```

## Performance Optimization

### ✅ DO: Use Appropriate Timeouts

```typescript
// Different timeouts for different operations
const quickClient = createHttpClient({
  baseUrl: 'https://api.example.com',
  timeout: 5_000, // 5 seconds for quick operations
})

const longRunningClient = createHttpClient({
  baseUrl: 'https://api.example.com',
  timeout: 60_000, // 60 seconds for heavy operations
})
```

### ✅ DO: Implement Request Cancellation

```typescript
async function searchUsers(query: string, signal?: AbortSignal) {
  return await apiClient.get('/users/search', {
    params: { q: query },
    signal,
  })
}

const controller = new AbortController()
const searchPromise = searchUsers('john', controller.signal)

// Cancel if needed
controller.abort()
```

## Testing

### ✅ DO: Mock HTTP Calls in Tests

```typescript
import { vi } from 'vitest'
import { apiClient } from '../api/client'

vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('UserService', () => {
  it('should fetch user by id', async () => {
    const mockUser = { id: 1, name: 'John', email: 'john@example.com' }

    vi.mocked(apiClient.get).mockResolvedValue({
      data: mockUser,
      status: 200,
      statusText: 'OK',
      headers: {},
      method: 'GET',
      url: '/users/1',
      raw: new Response(),
    })

    const user = await UserService.getUser('1')

    expect(apiClient.get).toHaveBeenCalledWith('/users/1')
    expect(user).toEqual(mockUser)
  })
})
```

### ✅ DO: Test Error Scenarios

```typescript
it('should handle user not found error', async () => {
  vi.mocked(apiClient.get).mockRejectedValue(
    new HttpError(
      'Not Found',
      404,
      'Not Found',
      null,
      new Response(),
      '/users/999',
      'GET'
    )
  )

  await expect(UserService.getUser('999')).rejects.toThrow('User not found')
})
```

### ✅ DO: Use MSW for Integration Tests

```typescript
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      name: 'John',
      email: 'john@example.com',
    })
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

## Security

### ✅ DO: Validate and Sanitize Input

```typescript
const CreateUserSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z\s]+$/),
  email: z.email().max(255),
  age: z.number().int().min(0).max(120).optional(),
})

async function createUser(userData: unknown) {
  // Validate input before sending
  const validatedData = CreateUserSchema.parse(userData)

  return await apiClient.post('/users', validatedData)
}
```

### ✅ DO: Configure baseUrl based on Environment

```typescript
const apiClient = createHttpClient({
  baseUrl:
    process.env.NODE_ENV === 'production'
      ? 'https://api.myapp.com'
      : 'http://localhost:3000/api',
})
```

### ✅ DO: Handle Sensitive Data Carefully

```typescript
// Don't log sensitive data
const apiClient = createHttpClient({
  onRequestMiddleware: async context => {
    const safeHeaders = new Headers(context.headers)
    if (safeHeaders.has('Authorization')) {
      safeHeaders.set('Authorization', '[REDACTED]')
    }

    const safeContext = {
      ...context,
      headers: Object.fromEntries(safeHeaders.entries()),
    }
    console.log('Request:', safeContext)
    return context
  },
})
```

### ❌ DON'T: Store Secrets in Client Code

```typescript
// Bad: Hardcoded API key
const apiClient = createHttpClient({
  baseUrl: 'https://api.example.com',
  headers: {
    'X-API-Key': 'sk-1234567890abcdef', // Never do this!
  },
})

// Good: Use environment variables
const apiClient = createHttpClient({
  baseUrl: process.env.API_BASE_URL,
  headers: {
    'X-API-Key': process.env.API_KEY,
  },
})
```

## Monitoring

### ✅ DO: Add Request Tracking

```typescript
import type { ResponseType } from '1000fetches'

async function trackRequest<T>(
  operation: string,
  request: () => Promise<ResponseType<T>>
) {
  const startTime = Date.now()

  try {
    const response = await request()
    const duration = Date.now() - startTime

    analytics.track('api_request', {
      operation,
      url: response.url,
      method: response.method,
      status: response.status,
      duration,
    })

    return response
  } catch (error) {
    analytics.track('api_request_failed', {
      operation,
      duration: Date.now() - startTime,
    })

    throw error
  }
}

const response = await trackRequest('fetch_user', () =>
  apiClient.get('/users/:id', {
    pathParams: { id: userId },
    headers: { 'X-Request-ID': generateRequestId() },
  })
)
```

### ✅ DO: Monitor Error Rates

```typescript
const apiClient = createHttpClient({
  onResponseMiddleware: async response => {
    if (response.status >= 400) {
      errorTracker.captureException(
        new Error(`API Error: ${response.status}`),
        {
          extra: {
            url: response.url,
            method: response.method,
            status: response.status,
            data: response.data,
          },
        }
      )
    }

    return response
  },
})
```

### ✅ DO: Set Up Health Checks

```typescript
async function healthCheck() {
  try {
    const response = await apiClient.get('/health', {
      timeout: 5_000,
      retry: false,
    })

    return response.status === 200
  } catch (error) {
    console.error('Health check failed:', error)
    return false
  }
}

// Run health check periodically
setInterval(healthCheck, 60_000)
```

## Common Anti-Patterns

### ❌ DON'T: Ignore Error Handling

```typescript
// Bad: Silent failures
try {
  const user = await apiClient.get('/users/1')
  return user.data
} catch {
  return null // Silently fails
}

// Good: Explicit error handling
try {
  const user = await apiClient.get('/users/1')
  return user.data
} catch (error) {
  if (error instanceof HttpError && error.status === 404) {
    return null
  }
  throw error // Re-throw unexpected errors
}
```

### ❌ DON'T: Use Generic Error Messages

```typescript
// Bad: Generic error
throw new Error('Something went wrong')

// Good: Specific error with context
try {
  await apiClient.get(`/users/${userId}`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  throw new Error(`Failed to fetch user ${userId}: ${message}`)
}
```

### ❌ DON'T: Block the Event Loop

```typescript
// Bad: Synchronous operations in middleware
const blockingClient = createHttpClient({
  onRequestMiddleware: context => {
    const metadata = fs.readFileSync('/path/to/metadata', 'utf8') // Blocks event loop
    context.headers.set('X-Metadata', metadata)
    return context
  },
})

// Good: Asynchronous operations
const asyncClient = createHttpClient({
  onRequestMiddleware: async context => {
    const metadata = await fs.promises.readFile('/path/to/metadata', 'utf8')
    context.headers.set('X-Metadata', metadata)
    return context
  },
})
```

## Summary

Following these best practices will help you build robust, maintainable, and performant applications with 1000fetches:

1. **Configure once, use everywhere** - Create a single, well-configured client instance
2. **Use dynamic defaults** - Resolve auth and request-shaped defaults per request
3. **Handle errors explicitly** - Don't let errors fail silently
4. **Validate data** - Use schemas to ensure data integrity
5. **Keep middleware lightweight** - Avoid heavy operations that slow down requests
6. **Test thoroughly** - Mock HTTP calls and test error scenarios
7. **Monitor in production** - Track request metrics and error rates
8. **Secure by default** - Validate input and handle sensitive data carefully
