# Client Setup And Defaults

Use `createHttpClient` once per API surface and share that client.

```ts
import { createHttpClient } from '1000fetches'

export const api = createHttpClient({
  baseUrl: 'https://api.example.com',
  timeout: 10_000,
})
```

## Dynamic Defaults

Use `defaults` for values that should be resolved per request without mutating the final request context. The callback receives `path`, `resolvedPath`, `method`, `params`, `pathParams`, `body`, `hasBody`, a readonly `requestOptions` snapshot, and static client fields such as `baseUrl`, `headers`, `timeout`, and `retry`.

```ts
const api = createHttpClient({
  baseUrl: 'https://api.example.com',
  defaults: async ({ resolvedPath, method, hasBody }) => {
    const token = await getToken()

    return {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(hasBody ? { 'X-Write': method } : {}),
      },
      timeout: resolvedPath.startsWith('/reports') ? 60_000 : 10_000,
      retry: method === 'GET',
      params: { locale: 'en-US' },
    }
  },
})
```

Merge order is static client config, then dynamic defaults, then request options, then request middleware. Request options win over defaults.

Use request options for one-off overrides:

```ts
await api.get('/health', {
  timeout: 2_000,
  retry: false,
  headers: { 'X-Probe': 'health' },
})
```

Do not use `defaults` to rewrite hosts or paths. Pass an absolute request URL or use request middleware when host/path mutation is truly needed. Dynamic defaults may set `headers`, `params`, `timeout`, `retry`, `responseType`, `fetchOptions`, `cache`, `credentials`, `mode`, and `redirect`; request options still win.
