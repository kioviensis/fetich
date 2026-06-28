# Path Params And URLs

Use path params for templated URL segments. Do not interpolate path params manually.

```ts
await api.get('/users/:userId/projects/:projectId', {
  pathParams: { userId, projectId },
})
```

Use `params` for query string values.

```ts
await api.get('/search', {
  params: {
    q: query,
    page,
    tags,
  },
})
```

For Node native `fetch`, provide an absolute `baseUrl` unless using a custom fetch implementation that supports relative URLs.

```ts
const api = createHttpClient({
  baseUrl: 'https://api.example.com',
})
```

Root-relative base URLs are useful in browser apps:

```ts
const api = createHttpClient({
  baseUrl: '/api',
})
```

Use `serializeParams` only when the default `URLSearchParams` behavior does not match the target API.
