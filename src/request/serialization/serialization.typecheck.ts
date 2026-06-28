// @ts-expect-error streaming event types are intentionally not exported
import type { UploadStreamingEvent as _UploadStreamingEvent } from '../../index'
// @ts-expect-error streaming event types are intentionally not exported
import type { DownloadStreamingEvent as _DownloadStreamingEvent } from '../../index'

import { createHttpClient } from '../../client'
import type { HttpRequestOptions } from '../../core'
import type { RequestOptions } from '../../types'

declare function acceptRequestOptions(options: RequestOptions): void
declare function acceptHttpRequestOptions(options: HttpRequestOptions): void

// @ts-expect-error upload streaming callbacks are not core request options
acceptRequestOptions({ onUploadStreaming: () => undefined })

// @ts-expect-error download streaming callbacks are not core request options
acceptHttpRequestOptions({ onDownloadStreaming: () => undefined })

const formClient = createHttpClient({
  serializeBody: (body: FormData): BodyInit => body,
})

formClient.post('/upload', new FormData())
formClient.put('/upload', new FormData())
formClient.patch('/upload', new FormData())
formClient.request('/upload', {
  method: 'POST',
  body: new FormData(),
})

// @ts-expect-error object bodies are rejected by a FormData serializer
formClient.post('/upload', { name: 'Ada' })

// @ts-expect-error URLSearchParams bodies are rejected by a FormData serializer
formClient.put('/upload', new URLSearchParams())

// @ts-expect-error string bodies are rejected by a FormData serializer
formClient.patch('/upload', 'name=Ada')

formClient.request('/upload', {
  method: 'POST',
  // @ts-expect-error object bodies are rejected by a FormData serializer
  body: { name: 'Ada' },
})

const jsonClient = createHttpClient()

jsonClient.post('/users', { name: 'Ada' })
jsonClient.put('/users/:id', { name: 'Ada' }, { pathParams: { id: '1' } })
jsonClient.patch('/users/:id', { name: 'Ada' }, { pathParams: { id: '1' } })
jsonClient.request('/users', {
  method: 'POST',
  body: { name: 'Ada' },
})

const unknownBodyClient = createHttpClient({
  serializeBody: (body: unknown) => JSON.stringify(body),
})

unknownBodyClient.post('/users', { name: 'Ada' })
unknownBodyClient.request('/users', {
  method: 'POST',
  body: { name: 'Ada' },
})
