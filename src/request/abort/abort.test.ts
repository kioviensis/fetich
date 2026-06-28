import { describe, expect, it, vi } from 'vitest'

import { AbortError, TimeoutError } from '../../errors'
import {
  createCombinedSignal,
  createPreAbortedRequestError,
  isAbortError,
  normalizeExecutionError,
  sleep,
} from '.'

describe('request abort helpers', () => {
  it('normalizes timeout aborts as TimeoutError', () => {
    const abortError = Object.assign(new Error('aborted'), {
      name: 'AbortError',
    })

    const error = normalizeExecutionError(abortError, {
      didTimeout: true,
      timeout: 25,
    })

    expect(error).toBeInstanceOf(TimeoutError)
    expect(error.cause).toBe(abortError)
  })

  it('normalizes caller-aborted signals as AbortError', () => {
    const controller = new AbortController()
    controller.abort(new Error('caller stopped'))

    const error = normalizeExecutionError(new Error('fetch aborted'), {
      didTimeout: false,
      finalSignal: controller.signal,
      timeout: 25,
    })

    expect(error).toBeInstanceOf(AbortError)
    expect((error.cause as Error | undefined)?.message).toBe('fetch aborted')
  })

  it('standardizes non-error execution failures', () => {
    const error = normalizeExecutionError('bad failure', {
      didTimeout: false,
      timeout: 25,
    })

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Request execution: bad failure')
  })

  it('creates pre-aborted errors from native AbortError values', () => {
    const nativeAbort = Object.assign(new Error('native abort'), {
      name: 'AbortError',
    })

    const error = createPreAbortedRequestError(nativeAbort)

    expect(error).toBeInstanceOf(AbortError)
    expect(error.message).toBe('Request aborted by caller')
    expect(error.cause).toBe(nativeAbort)
  })

  it('creates generic AbortError for unknown abort reasons', () => {
    const error = createPreAbortedRequestError(undefined)

    expect(error).toBeInstanceOf(AbortError)
    expect(error.message).toBe('The operation was aborted')
  })

  it('resolves and rejects sleep with timer and abort handling', async () => {
    vi.useFakeTimers()

    try {
      const resolved = sleep(10)
      await vi.advanceTimersByTimeAsync(10)
      await expect(resolved).resolves.toBeUndefined()

      const controller = new AbortController()
      const rejected = sleep(10, controller.signal)
      controller.abort(new Error('stop waiting'))

      await expect(rejected).rejects.toMatchObject({
        name: 'AbortError',
        message: 'stop waiting',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects sleep immediately when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort(new Error('already stopped'))

    await expect(sleep(10, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
      message: 'already stopped',
    })
  })

  it('combines absent, single, pre-aborted, and live signals', () => {
    const none = createCombinedSignal()
    expect(none.signal).toBeUndefined()
    none.cleanup()

    const requestOnly = new AbortController()
    expect(createCombinedSignal(requestOnly.signal).signal).toBe(
      requestOnly.signal
    )

    const timeoutOnly = new AbortController()
    expect(createCombinedSignal(undefined, timeoutOnly.signal).signal).toBe(
      timeoutOnly.signal
    )

    const preAbortedRequest = new AbortController()
    preAbortedRequest.abort('request')
    expect(
      createCombinedSignal(preAbortedRequest.signal, timeoutOnly.signal).signal
    ).toBe(preAbortedRequest.signal)

    const preAbortedTimeout = new AbortController()
    preAbortedTimeout.abort('timeout')
    expect(
      createCombinedSignal(requestOnly.signal, preAbortedTimeout.signal).signal
    ).toBe(preAbortedTimeout.signal)

    const liveRequest = new AbortController()
    const liveTimeout = new AbortController()
    const combined = createCombinedSignal(
      liveRequest.signal,
      liveTimeout.signal
    )

    liveRequest.abort('combined reason')

    expect(combined.signal?.aborted).toBe(true)
    expect(combined.signal?.reason).toBe('combined reason')
    combined.cleanup()
  })

  it('identifies AbortError-shaped errors', () => {
    expect(
      isAbortError(
        Object.assign(new Error('stop'), {
          name: 'AbortError',
        })
      )
    ).toBe(true)
    expect(isAbortError(new Error('stop'))).toBe(false)
  })
})
