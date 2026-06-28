# 1000fetches

_Schema-powered Fetch 2.0 — where types meet runtime reality_
<br/>

[![npm version](https://img.shields.io/npm/v/1000fetches?style=flat-square)](https://www.npmjs.com/package/1000fetches)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

> Built for the 1000th call to be as safe as the first

### The problem

You start with `fetch`, then add a wrapper for error handling.
Then generics. Then path params. Then retries and timeouts.
Soon every project grows its own version — slightly different, equally fragile.

**Alternatives**? Tiny helpers that stop halfway,
or heavy Axios-style clients that add weight without type guarantees.

---

### The idea

A type-first HTTP client that unifies validation, dynamic defaults, retries, and middleware on top of native `fetch`.

---

### Highlights

- 🧭 **Compile-time path safety** — `:pathParam` can't slip through undefined
- 🧩 **Schema-driven validation** — infer types at build time, verify data at runtime
- ⚙️ **Dynamic defaults** — resolve auth, params, timeouts, and fetch options per request
- 🔁 **Retries, timeouts, middleware** — production essentials with opt-ins
- 🎯 **Method-based API** — `api.get()` with response contracts `.contract()` and extractor `.data()` for clean and concise code
- 🧠 **Designed for flow** — clear API, predictable behavior, no hidden magic

---

## Quickstart

```bash
npm install 1000fetches
```

```ts
import { createHttpClient } from '1000fetches'
import { z } from 'zod'

// Create client
const api = createHttpClient({
  baseUrl: 'https://api.example.com',
})

// Define schemas for types and safety
const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.email(),
})

// Request data with a response contract
const userResponse = await api
  .get('/users/:id', {
    pathParams: { id: '123' },
  })
  .contract(userSchema)
// userResponse.data 👉 { id: number, ... }

// Clean data extraction with full type safety
const user = await api
  .get('/users/:id', {
    pathParams: { id: '123' },
  })
  .contract(userSchema)
  .data()
// user 👉 { id: number, ... }
```

With native Node `fetch`, requests must resolve to absolute URLs. Use an absolute `baseUrl` in Node, or provide a custom `fetch` implementation that supports relative URLs.

## ➡️ Key Features

### ✔️ Type Safety That Actually Works

- **Compile-time path validation** — TypeScript catches missing `:userId` parameters before runtime
- **Trailing optional path params only** — `'/users/:id?'` supported, `'/users/:id?/cards/:cardId'` rejected
- **Runtime schema validation** — Schemas verify data at the network boundary
- **Schema-based type inference** — Types inferred from schemas, no generics needed
- **Multi-schema support** — [Zod](https://github.com/colinhacks/zod), [Valibot](https://github.com/fabian-hiller/valibot), [ArkType](https://github.com/arktypeio/arktype), or any [Standard Schema](https://github.com/standard-schema/standard-schema)-compatible library

### ✔️ Production-Ready Quality

- **Smart retry logic** — Opt-in exponential backoff for resilient requests
- **Timeout and cancellation support** — Built-in `AbortController` integration
- **Structured error handling** — `HttpError`, `NetworkError`, `TimeoutError` with full context
- **Dynamic defaults and middleware** — Authentication, logging, transformations
- **Minimalistic footprint** — Production features without the bloat

### ✔️ Engineer-Friendly DX

- **Method-based API** — `api.get()`, `api.post()`, `api.put()`, `api.patch()`, `api.delete()`, and generic `api.request()` with full type safety
- **Contract-first validation** — Chain `.contract()` for runtime validation and automatic type inference
- **Smart data extraction** — Chain `.data()` for direct value access without `.data` property
- **Automatic response parsing** — JSON/text responses parsed automatically
- **Per-request defaults** — Resolve auth, params, timeouts, retry settings, and fetch options from request context
- **Tiny runtime footprint** — one tiny Standard Schema type dependency, tree-shakable builds
- **TypeScript-first** — Full type inference and `IntelliSense` support

**1000fetches** combines native `fetch` performance with production-oriented features and schema-backed type safety.

## ➡️ Usage Examples

### Authentication

```ts
const api = createHttpClient({
  baseUrl: 'https://api.example.com',
  headers: { Authorization: `Bearer ${token}` },
})

// Or dynamic auth
const api = createHttpClient({
  baseUrl: 'https://api.example.com',
  defaults: async () => {
    const token = await getToken()
    return {
      headers: { Authorization: `Bearer ${token}` },
    }
  },
})
```

### Dynamic Defaults

```ts
const api = createHttpClient({
  baseUrl: 'https://api.example.com',
  defaults: ({ resolvedPath, method }) => ({
    headers: { 'X-Client': 'dashboard' },
    timeout: resolvedPath.startsWith('/reports') ? 60_000 : 10_000,
    retry: method === 'GET',
    params: { locale: 'en-US' },
  }),
})
```

### Middleware

```ts
const api = createHttpClient({
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

Middleware can observe requests and responses, but it can also mutate them. Keep middleware side-effect-light; use mutation only when dynamic defaults are not enough.

### Error Handling

```ts
import {
  AbortError,
  HttpError,
  NetworkError,
  TimeoutError,
  MiddlewareError,
  PathParameterError,
  SchemaValidationError,
} from '1000fetches'

try {
  const user = await api
    .get('/users/:id', {
      pathParams: { id: '123' },
    })
    .contract(userSchema)
} catch (error) {
  if (error instanceof HttpError) {
    console.log(`HTTP ${error.status}: ${error.statusText}`)
  } else if (error instanceof NetworkError) {
    console.log('Network error:', error.message)
  } else if (error instanceof TimeoutError) {
    console.log('Request timed out')
  } else if (error instanceof AbortError) {
    console.log('Request was cancelled')
  } else if (error instanceof MiddlewareError) {
    console.log('Middleware error:', error.message)
  } else if (error instanceof PathParameterError) {
    console.log('Path parameter error:', error.message)
  } else if (error instanceof SchemaValidationError) {
    console.log('Schema validation error:', error.message)
  }
}
```

## API Reference

### <samp>createHttpClient(config?)</samp>

Creates a new HTTP client with optional configuration.

```ts
function createHttpClient(config?: HttpClientConfig)
```

**Configuration Options:**

| Option                 | Type                                                                                     | Description                        |
| ---------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------- |
| `baseUrl`              | `string`                                                                                 | Absolute or root-relative base URL |
| `headers`              | `Record<string, string>`                                                                 | Default headers                    |
| `timeout`              | `number`                                                                                 | Default timeout in milliseconds    |
| `retry`                | `RetryOptions \| boolean`                                                                | Opt-in retry configuration         |
| `fetch`                | `typeof fetch`                                                                           | Custom fetch-compatible transport  |
| `serializeBody`        | `(body: TBody) => BodyInit \| null \| undefined`                                         | Custom request body serializer     |
| `serializeParams`      | `(params) => string`                                                                     | Custom query parameter serializer  |
| `defaults`             | `(context) => RequestDefaults \| void \| Promise<RequestDefaults \| void>`               | Dynamic request defaults           |
| `onRequestMiddleware`  | `(context: RequestContext) => RequestContext \| void \| Promise<RequestContext \| void>` | Request middleware                 |
| `onResponseMiddleware` | `(response: ResponseType) => ResponseType \| Promise<ResponseType>`                      | Response middleware                |
| `schemaValidator`      | `SchemaValidator`                                                                        | Custom schema validator            |

### <samp>HTTP Methods</samp>

All HTTP methods support response contracts and data extraction:

```ts
// GET
const user = await api
  .get('/users/:id', {
    pathParams: { id: '123' },
  })
  .contract(userSchema)
  .data()
// user 👉 Fully typed user object

// POST
const newUser = await api.post('/users', userData).contract(userSchema).data()
// newUser 👉 Fully typed user object

// PUT
const updatedUser = await api
  .put('/users/:id', userData, {
    pathParams: { id: '123' },
  })
  .contract(userSchema)
  .data()
// updatedUser 👉 Fully typed user object

// PATCH
const patchedUser = await api
  .patch('/users/:id', partialData, {
    pathParams: { id: '123' },
  })
  .contract(userSchema)
  .data()
// patchedUser 👉 Fully typed user object

// DELETE
await api.delete('/users/:id', {
  pathParams: { id: '123' },
})
```

### <samp>Request Options</samp>

| Option         | Type                                                        | Description                       |
| -------------- | ----------------------------------------------------------- | --------------------------------- |
| `pathParams`   | `Record<string, string \| number \| undefined>`             | Path parameters for URL templates |
| `params`       | `RequestParamsType`                                         | Query parameters                  |
| `headers`      | `Record<string, string>`                                    | Request headers                   |
| `body`         | `TBody`                                                     | Request body                      |
| `timeout`      | `number`                                                    | Request timeout                   |
| `signal`       | `AbortSignal`                                               | Request cancellation signal       |
| `responseType` | `'json' \| 'text' \| 'blob' \| 'arrayBuffer' \| 'formData'` | Response type override            |
| `cache`        | `RequestCache`                                              | Cache mode                        |
| `credentials`  | `RequestCredentials`                                        | Credentials mode                  |
| `mode`         | `RequestMode`                                               | Request mode                      |
| `redirect`     | `RequestRedirect`                                           | Redirect mode                     |
| `fetchOptions` | `FetchOptions`                                              | Native Fetch/Node passthrough     |
| `retry`        | `RetryOptions \| boolean`                                   | Retry configuration               |

### <samp>Retry Options</samp>

Retries are disabled unless you set client `retry`, request `retry: true`, or request retry settings. The built-in policy retries idempotent methods by default (`GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE`), honors `Retry-After`, supports jitter, and never retries one-shot `ReadableStream` request bodies.

```ts
const api = createHttpClient({
  retry: {
    maxRetries: 3,
    retryDelay: 250,
    jitter: 'full',
    onRetry: event => {
      console.log(event.method, event.url, event.nextAttempt)
    },
  },
})
```

### <samp>Status and Empty Responses</samp>

By default, 1000fetches treats any 2xx response as successful. Declare valid non-2xx protocol flows, such as `304 Not Modified`, in response contracts.

Responses that cannot carry a body (`204`, `205`, `304`, and `HEAD`) resolve with `data: undefined` without attempting JSON parsing.

```ts
const response = await api.get('/cached-resource').contract({
  success: {
    default: CachedResourceSchema,
    304: z.undefined(),
  },
})
```

### <samp>Response Object</samp>

All requests return a `ResponseType<T>` object:

```ts
interface ResponseType<T> {
  data: T // Parsed response data
  status: number // HTTP status code
  statusText: string // HTTP status text
  headers: HttpHeaders // Response headers
  method: HttpMethod
  url: string // Final URL
  raw: Response // Raw fetch Response
}
```

### <samp>Response Contracts</samp>

The library provides a chainable API for response contracts:

```ts
// Without contract
const response = await api.get('/users/:id', {
  pathParams: { id: '123' },
})
// response 👉 ResponseType<unknown>

// With a schema contract
const response = await api
  .get('/users/:id', {
    pathParams: { id: '123' },
  })
  .contract(userSchema)
// response 👉 ResponseType<User>
```

Contracts can also describe success and error bodies by status:

```ts
await api.post('/transactions', transactionInput).contract({
  success: {
    default: CreatedTransactionSchema,
    201: EmptyResponseSchema,
  },
  error: {
    default: ErrorSchema,
    400: BadTransactionResponseSchema,
    409: AlreadyCreatedTransactionResponseSchema,
  },
})
```

Success status maps accept only `2xx` and `3xx` status keys. Error status maps accept only `4xx` and `5xx` status keys. Success map status keys control which non-2xx responses resolve; error contracts validate failed responses before `HttpError` is thrown.

Error branches validate failed HTTP responses before throwing `HttpError` with the validated error data. If an error response fails its own contract, 1000fetches throws `ContractValidationError` with the status, method, URL, response, schema, and original data.

### <samp>Data Extraction</samp>

The method-based API provides clean data extraction with full type safety:

```ts
// Extract untyped data (without contract)
const data = await api
  .get('/users/:id', {
    pathParams: { id: '123' },
  })
  .data()
// data 👉 unknown

// Direct typed data extraction (with contract)
const user = await api
  .get('/users/:id', {
    pathParams: { id: '123' },
  })
  .contract(userSchema)
  .data()
// user 👉 { id: number, ... }

// Works with all HTTP methods
const newUser = await api.post('/users', userData).contract(userSchema).data()
// newUser 👉 Fully typed user object

const updatedUser = await api
  .put('/users/:id', userData, { pathParams: { id: '123' } })
  .contract(userSchema)
  .data()
// updatedUser 👉 Fully typed user object

// Run the request and intentionally ignore response data
await api.delete('/users/:id', { pathParams: { id: '123' } }).void()
```

## ➡️ Design Trade-Offs

1000fetches is intentionally small, but it is not just a thin `fetch` alias. It focuses on the features that tend to become repetitive in application code:

| Capability            | What 1000fetches Provides                                             |
| --------------------- | --------------------------------------------------------------------- |
| **TypeScript**        | Schema-inferred response types and typed path parameters              |
| **Path Params**       | Compile-time and runtime checks for `:param` placeholders             |
| **Schema Validation** | Standard Schema support for Zod, Valibot, ArkType, and more           |
| **Retry Logic**       | Opt-in retry policy with backoff, jitter, and `Retry-After`           |
| **Error Handling**    | Structured errors for HTTP, network, timeout, and validation failures |
| **Dynamic Defaults**  | Per-request headers, params, timeout, retry, and fetch options        |
| **Middleware**        | Request and response middleware with typed context                    |
| **Tree Shaking**      | Side-effect-free ESM/CJS builds                                       |

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

<div align="center">

**Built for developers who believe type safety shouldn't be optional.**
**Because your backend deserves skepticism.**

</div>

<!-- Links -->

[zod]: https://zod.dev/
[valibot]: https://valibot.dev/
[arktype]: https://arktype.dev/
[standard-schema]: https://github.com/standard-schema/standard-schema
