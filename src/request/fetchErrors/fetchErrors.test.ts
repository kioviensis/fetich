import { describe, expect, it } from 'vitest'

import { NetworkError } from '../../errors'
import { createHttpError, fetchWithNetworkError } from '.'

describe('request error helpers', () => {
  it('wraps non-error fetch failures as NetworkError', async () => {
    const fetchImplementation = (async () => {
      return await Promise.reject('network down')
    }) as unknown as typeof fetch

    const error = await fetchWithNetworkError(
      fetchImplementation,
      'https://api.example.com/users',
      {}
    ).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(NetworkError)
    expect((error as NetworkError).cause?.message).toBe(
      'Network request failed: network down'
    )
  })

  it('preserves existing NetworkError instances from fetch', async () => {
    const networkError = new NetworkError('offline')
    const fetchImplementation = (async () => {
      throw networkError
    }) as unknown as typeof fetch

    await expect(
      fetchWithNetworkError(
        fetchImplementation,
        'https://api.example.com/users',
        {}
      )
    ).rejects.toBe(networkError)
  })

  it('creates HttpError with response metadata and cause', () => {
    const raw = new Response('{"error":"nope"}', { status: 500 })
    const cause = new Error('parse failed')
    const error = createHttpError(
      {
        data: { error: 'nope' },
        headers: {},
        method: 'GET',
        raw,
        status: 500,
        statusText: '',
        url: 'https://api.example.com/users',
      },
      cause
    )

    expect(error.status).toBe(500)
    expect(error.response).toBe(raw)
    expect(error.cause).toBe(cause)
  })
})
