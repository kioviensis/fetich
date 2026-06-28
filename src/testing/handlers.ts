import { http, HttpResponse } from 'msw'
import { USER, USERS } from './fixtures'

const BASE_URL = 'https://api.example.com'

const createHandler =
  (method: keyof typeof http) =>
  (path: string, handler: Parameters<typeof http.get>[1]) =>
    http[method](`${BASE_URL}${path}`, handler)

const get = createHandler('get')
const post = createHandler('post')
const put = createHandler('put')
const patch = createHandler('patch')
const del = createHandler('delete')

const requestCounts = new Map<string, number>()

export const resetState = () => {
  requestCounts.clear()
}

const getAndIncrementCount = (testId: string): number => {
  const current = requestCounts.get(testId) || 0
  const next = current + 1
  requestCounts.set(testId, next)
  return next
}

const findOrCreateUser = (id: number) => {
  return (
    USERS.find(user => user.id === id) || {
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`,
    }
  )
}

const parseRequestBody = async (request: Request) => {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData()
      return {
        name: formData.get('name') as string,
        email: formData.get('email') as string,
      }
    } catch {
      return {}
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    try {
      const text = await request.text()
      const params = new URLSearchParams(text)
      return {
        name: params.get('name') as string,
        email: params.get('email') as string,
      }
    } catch {
      return {}
    }
  }

  try {
    return await request.json()
  } catch {
    return {}
  }
}

export const handlers = [
  get('/users', async ({ request }) => {
    const url = new URL(request.url)
    const page = url.searchParams.get('page')
    const limit = url.searchParams.get('limit')

    return HttpResponse.json({
      users: USERS,
      pagination: {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
        total: USERS.length,
      },
    })
  }),

  get('/users/:id', async ({ params }) => {
    return HttpResponse.json(findOrCreateUser(Number(params.id)))
  }),

  get('/users/:id/posts', async ({ params }) => {
    const userId = Number(params.id)
    const user = findOrCreateUser(userId)
    return HttpResponse.json({
      ...user,
      posts: [
        { id: 1, title: 'First Post', content: 'Hello', userId },
        { id: 2, title: 'Second Post', content: 'World', userId },
      ],
    })
  }),

  get('/users/:id/with-posts', async ({ params }) => {
    const userId = Number(params.id)
    const user = findOrCreateUser(userId)
    return HttpResponse.json({
      user,
      posts: [
        { id: 1, title: 'First Post', content: 'Hello', userId },
        { id: 2, title: 'Second Post', content: 'World', userId },
      ],
      metadata: { totalPosts: 2, lastUpdated: '2024-01-01' },
    })
  }),

  get('/users/:id/posts/:postId', async ({ params }) => {
    const userId = Number(params.id)
    const postId = Number(params.postId)
    return HttpResponse.json({
      id: postId,
      title: `Post ${postId}`,
      content: `Content for post ${postId}`,
      userId,
    })
  }),

  get('/users/:id/detailed', async ({ params }) => {
    const userId = Number(params.id)
    const user = findOrCreateUser(userId)
    return HttpResponse.json({
      ...user,
      status: 'active',
      address: {
        street: '123 Main St',
        city: 'New York',
        country: 'USA',
        coordinates: { lat: 40.7128, lng: -74.006 },
      },
      profile: {
        bio: 'A sample user',
        avatar: 'https://example.com/avatar.jpg',
        social: { twitter: '@user', linkedin: 'user-linkedin' },
      },
      metadata: {
        createdAt: '2024-01-01T00:00:00Z',
        lastLogin: '2024-01-02T00:00:00Z',
        permissions: ['read', 'write'],
      },
    })
  }),

  get(
    '/users/:userId/posts/:postId/comments/:commentId',
    async ({ params }) => {
      return HttpResponse.json({
        id: Number(params.commentId),
        text: 'Comment text',
        postId: Number(params.postId),
      })
    }
  ),

  post('/users', async ({ request }) => {
    const body = await parseRequestBody(request)
    const newUser = { id: USERS.length + 1, ...body }
    return HttpResponse.json(newUser, { status: 201 })
  }),

  post('/users/:id', async ({ params, request }) => {
    const body = await parseRequestBody(request)
    return HttpResponse.json(
      { id: Number(params.id), ...body },
      { status: 201 }
    )
  }),

  put('/users/:id', async ({ params, request }) => {
    const body = await parseRequestBody(request)
    return HttpResponse.json({ id: Number(params.id), ...body })
  }),

  patch('/users/:id', async ({ params, request }) => {
    const body = await parseRequestBody(request)
    return HttpResponse.json({
      id: Number(params.id),
      name: body.name ?? 'John Updated',
      email: body.email ?? 'john@example.com',
      ...body,
    })
  }),

  del('/users/:id', () => HttpResponse.json({ success: true })),

  put('/users', async ({ request }) => {
    const body = await parseRequestBody(request)
    return HttpResponse.json(body)
  }),

  patch('/users', async ({ request }) => {
    const body = await parseRequestBody(request)
    return HttpResponse.json(body)
  }),

  del('/users', () => HttpResponse.json({ success: true })),

  get('/posts/:id', async ({ params }) => {
    const postId = Number(params.id)
    return HttpResponse.json({
      id: postId,
      title: `Post ${postId}`,
      content: `Content for post ${postId}`,
    })
  }),

  get('/test', () => HttpResponse.json({ status: 'ok', success: true })),
  get('/standard-schema-users/:id', () => HttpResponse.json(USER)),

  get('/empty', () => new HttpResponse(null, { status: 204 })),
  get('/text', () => HttpResponse.text('plain text response')),
  get('/blob', () => HttpResponse.arrayBuffer(new ArrayBuffer(8))),

  get('/error', () =>
    HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  ),
  get('/bad-request', () =>
    HttpResponse.json({ error: 'Bad Request' }, { status: 400 })
  ),
  get('/backoff-test', () =>
    HttpResponse.json({ error: 'Server Error' }, { status: 500 })
  ),

  get('/timeout', async () => {
    await new Promise(resolve => setTimeout(resolve, 200))
    return HttpResponse.json({ message: 'This should timeout' })
  }),

  get('/slow-request', () =>
    HttpResponse.json({ message: 'This should be aborted' })
  ),

  get('/retry-test', async () => {
    const testId = 'retry-testing'
    const count = getAndIncrementCount(testId)
    if (count <= 2) {
      return HttpResponse.json({ error: 'Server Error' }, { status: 500 })
    }
    return HttpResponse.json({ success: true })
  }),

  get('/network-retry', async () => {
    const testId = 'network-retry'
    const count = getAndIncrementCount(testId)
    if (count === 1) {
      return HttpResponse.error()
    }
    return HttpResponse.json({ success: true })
  }),

  get('/complex', async ({ request }) => {
    const isIntegrationTest = request.headers.get('X-Test') === 'true'
    if (isIntegrationTest) {
      const testId = 'integration-complex'
      const count = getAndIncrementCount(testId)
      if (count === 1) {
        return HttpResponse.json({ error: 'Server Error' }, { status: 500 })
      }
      return HttpResponse.json({ success: true, attempt: count })
    }
    return HttpResponse.json({ success: true })
  }),

  get('/integration-test', async ({ request }) => {
    const retryHeader = request.headers.get('X-Retry-Count')
    const retryCount = retryHeader ? parseInt(retryHeader, 10) : 0
    if (retryCount === 0) {
      return HttpResponse.json({ error: 'Server Error' }, { status: 500 })
    }
    return HttpResponse.json({ success: true, retryCount })
  }),

  post('/login', async ({ request }) => {
    const body = await parseRequestBody(request)
    if (body.username) {
      return HttpResponse.json({ token: 'testing-token' })
    }
    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }),

  get('/profile', async ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (auth && auth.includes('Bearer testing-token')) {
      return HttpResponse.json({ id: 1, name: 'Test User' })
    }
    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }),

  post('/upload', () => HttpResponse.json({ success: true }, { status: 201 })),

  get('https://api.example.com/users', async ({ request }) => {
    const url = new URL(request.url)
    const page = url.searchParams.get('page')
    return HttpResponse.json({
      users: USERS,
      pagination: { page: page ? Number(page) : 1, total: USERS.length },
    })
  }),

  get('https://api.example.com/posts/:id', async ({ params }) => {
    const postId = Number(params.id)
    return HttpResponse.json({
      id: postId,
      title: `Post ${postId}`,
      content: `Content for post ${postId}`,
    })
  }),
]
