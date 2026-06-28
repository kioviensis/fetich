# Serialization And Body Types

Without a custom serializer, objects and arrays are JSON stringified and get `content-type: application/json` when no explicit content type is set.

```ts
await api.post('/users', { name: 'Ada' })
```

Native body values such as `FormData`, `URLSearchParams`, `Blob`, `ArrayBuffer`, `ArrayBufferView`, strings, and `ReadableStream` are passed as fetch bodies. When sending a `ReadableStream` in Node/native fetch contexts that require it, set `fetchOptions: { duplex: 'half' }`.

Use `serializeBody` when an API needs a custom wire format. A narrow serializer narrows accepted bodies for write methods.

```ts
const uploadApi = createHttpClient({
  baseUrl: 'https://api.example.com',
  serializeBody: (body: FormData): BodyInit => body,
})

await uploadApi.post('/files', formData)
```

When modifying this library, preserve runtime serializer behavior and add type tests for accepted and rejected body types. Do not weaken normal JSON/object body inference for clients without a custom serializer.
