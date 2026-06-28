# Retries, Timeouts, And Middleware

Retries are opt-in. Default retry methods are idempotent: `GET`, `HEAD`, `OPTIONS`, `PUT`, and `DELETE`.

```ts
const api = createHttpClient({
  retry: {
    maxRetries: 3,
    retryDelay: 250,
    jitter: 'full',
  },
})
```

Use `retry: false` for operations that must not be retried.

```ts
await api.post('/payments', payment, { retry: false })
```

Use timeouts at the client level for normal requests, dynamic defaults for route-shaped timeouts, and request options for one-off overrides.

Middleware is allowed to observe and mutate request or response state. Keep it side-effect-light. Use dynamic defaults for auth, headers, params, timeout, retry, response type, and fetch options before reaching for middleware.

Good middleware uses:

- log request and response metadata
- add a generated request id
- normalize response data
- rewrite URL or method only when mutation is required

Do not add broad lifecycle hooks. Do not recommend streaming callbacks; streaming telemetry is intentionally not part of the core API.
