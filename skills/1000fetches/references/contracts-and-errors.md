# Contracts And Errors

Use `.contract()` when response data should be validated at runtime and inferred at compile time. Pass Standard Schema-compatible schemas such as Zod, Valibot, or ArkType schemas.

```ts
import { HttpError } from '1000fetches'
import { z } from 'zod'

const UserSchema = z.object({ id: z.string(), name: z.string() })

const user = await api
  .get('/users/:id', { pathParams: { id } })
  .contract(UserSchema)
  .data()
```

Use status-specific contracts for APIs with known success or error shapes.

```ts
await api.post('/transactions', input).contract({
  success: {
    default: TransactionSchema,
    202: AcceptedSchema,
  },
  error: {
    default: ApiErrorSchema,
    409: ConflictSchema,
  },
})
```

Success status maps accept `2xx` and `3xx` keys. Error status maps accept `4xx` and `5xx` keys.

Handle specific errors instead of broad `Error` checks when behavior differs:

```ts
try {
  return await api
    .get('/users/:id', { pathParams: { id } })
    .contract(UserSchema)
} catch (error) {
  if (error instanceof HttpError && error.status === 404) {
    return null
  }

  throw error
}
```

Prefer `.data()` when the caller only needs the parsed body. Use `.void()` for endpoints where a successful response body should be ignored. Keep the full response when status, headers, URL, or raw `Response` matters.
