import { type } from 'arktype'
import { expectTypeOf } from 'expect-type'
import { number, object, string } from 'valibot'
import { z } from 'zod'
import { createHttpClient } from '../client'
import { createSchemaValidator } from '.'

const zodUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.email(),
})

type User = z.infer<typeof zodUserSchema>
const testUser: User = {
  id: 1,
  name: 'Leanne Graham',
  email: 'Sincere@april.biz',
}

const valibotUserSchema = object({
  id: number(),
  name: string(),
  email: string(),
})

const arktypeUserSchema = type({
  id: 'number',
  name: 'string',
  email: 'string',
})

describe('Standard schema validator integration', () => {
  let client: ReturnType<typeof createHttpClient>

  beforeEach(() => {
    client = createHttpClient({
      baseUrl: 'https://api.example.com',
      schemaValidator: createSchemaValidator(),
    })
  })

  test('should validate user data with different schema libraries', async () => {
    const zodResponse = await client
      .get('/standard-schema-users/1')
      .contract(zodUserSchema)
    expectTypeOf(zodResponse.data).toEqualTypeOf<User>()
    expect(zodResponse.data).toEqual(testUser)

    const valibotResponse = await client
      .get('/standard-schema-users/1')
      .contract(valibotUserSchema)
    expectTypeOf(valibotResponse.data).toEqualTypeOf<User>()
    expect(valibotResponse.data).toEqual(testUser)

    const arktypeResponse = await client
      .get('/standard-schema-users/1')
      .contract(arktypeUserSchema)
    expectTypeOf(arktypeResponse.data).toEqualTypeOf<User>()
    expect(arktypeResponse.data).toEqual(testUser)
  })
})
