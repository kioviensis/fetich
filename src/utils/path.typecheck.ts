import { createHttpClient } from '../client'
import { generatePath } from './path'

const client = createHttpClient({ baseUrl: 'https://api.example.com' })
const dynamicPath: string = '/users/:id'

// GET
// @ts-expect-error required path params must be provided
client.get('/users/:id')
// @ts-expect-error required path params must be provided
client.get('/users/:id', {})
// @ts-expect-error incorrect path param name
client.get('/users/:id', { pathParams: { id2: 1 } })
client.get('/users/:id?', { pathParams: { id: 1 } })
client.get('/users/:id?')
client.get(dynamicPath, { pathParams: { id: 1 } })
// @ts-expect-error leading bare required path params must be provided
client.get(':id/users')
client.get(':id/users', { pathParams: { id: 1 } })
client.get('users/:id', { pathParams: { id: 1 } })
client.get('https://api.example.com/users/:id', { pathParams: { id: 1 } })
client.get('/users/:id', { pathParams: { id: 1 } })
// @ts-expect-error optional path params must be trailing
client.get('/users/:id?/posts/:postId', {
  pathParams: { postId: 1 },
})

// POST
// @ts-expect-error required path params must be provided
client.post('/users/:id')
// @ts-expect-error required path params must be provided
client.post('/users/:id', { name: 'Test' })
// @ts-expect-error incorrect path param name
client.post('/users/:id', { name: 'Test' }, { pathParams: { test: 'test' } })
client.post('/users/:id?', { name: 'Test' })
client.post('/users/:id?', { name: 'Test' }, { pathParams: { id: 1 } })
client.post(dynamicPath, { name: 'Test' }, { pathParams: { id: 1 } })
// @ts-expect-error optional path params must be trailing
// prettier-ignore
client.post('/users/:id?/posts/:postId', { name: 'Test' }, {
  pathParams: { postId: 1 },
})

// PUT
// @ts-expect-error required path params must be provided
client.put('/users/:id', { name: 'Test' })
client.put('/users/:id?', { name: 'Test' })
client.put('/users/:id?', { name: 'Test' }, { pathParams: { id: 1 } })
client.put(dynamicPath, { name: 'Test' }, { pathParams: { id: 1 } })
// @ts-expect-error optional path params must be trailing
// prettier-ignore
client.put('/users/:id?/posts/:postId', { name: 'Test' }, {
  pathParams: { postId: 1 },
})

// PATCH
// @ts-expect-error required path params must be provided
client.patch('/users/:id', { name: 'Test' })
client.patch('/users/:id?', { name: 'Test' })
client.patch('/users/:id?', { name: 'Test' }, { pathParams: { id: 1 } })
client.patch(dynamicPath, { name: 'Test' }, { pathParams: { id: 1 } })
// @ts-expect-error optional path params must be trailing
// prettier-ignore
client.patch('/users/:id?/posts/:postId', { name: 'Test' }, {
  pathParams: { postId: 1 },
})

// DELETE
// @ts-expect-error required path params must be provided
client.delete('/users/:id')
client.delete('/users/:id?')
client.delete('/users/:id?', { pathParams: { id: 1 } })
client.delete(dynamicPath, { pathParams: { id: 1 } })
// @ts-expect-error optional path params must be trailing
client.delete('/users/:id?/posts/:postId', {
  pathParams: { postId: 1 },
})

// REQUEST
// @ts-expect-error required path params must be provided
client.request('/users/:id')
// @ts-expect-error required path params must be provided
client.request('/users/:id', { method: 'GET' })
// @ts-expect-error incorrect path param name
client.request('/users/:id', { method: 'GET', pathParams: { id2: 1 } })
client.request('/users/:id', { method: 'GET', pathParams: { id: 1 } })
client.request('/webdav', { method: 'PROPFIND' })
client.request('/users/:id?', { method: 'GET' })
client.request('/users/:id?', { method: 'GET', pathParams: { id: 1 } })
// @ts-expect-error optional path params must be trailing
client.request('/users/:id?/posts/:postId', {
  method: 'GET',
  pathParams: { postId: 1 },
})

// generatePath
generatePath('/users')
// @ts-expect-error required path params must be provided
generatePath('/users/:id')
// @ts-expect-error required path params must be provided
generatePath('/users/:id', {})
generatePath('/users/:id', { id: 1 })
generatePath('/users/:id?')
generatePath('/users/:id?', { id: 1 })
// @ts-expect-error leading bare required path params must be provided
generatePath(':id/users')
generatePath(':id/users', { id: 1 })
generatePath('users/:id', { id: 1 })
generatePath('https://api.example.com/users/:id', { id: 1 })
// @ts-expect-error optional path params must be trailing
generatePath('/users/:id?/posts/:postId')
// @ts-expect-error optional path params must be trailing
generatePath('/users/:id?/posts/:postId', { postId: 1 })
