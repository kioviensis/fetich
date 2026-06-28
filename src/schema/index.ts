import type { StandardSchemaV1 } from '@standard-schema/spec'
import { InvalidSchemaError, SchemaValidationError } from '../errors'
import { Schema } from '../types'

/**
 * Type guard to check if an object conforms to the Standard Schema V1 specification
 */
function isStandardSchema(obj: unknown): obj is StandardSchemaV1 {
  return (
    obj !== null &&
    (typeof obj === 'object' || typeof obj === 'function') &&
    '~standard' in obj &&
    typeof obj['~standard'] === 'object' &&
    obj['~standard'] !== null &&
    'validate' in obj['~standard'] &&
    typeof obj['~standard'].validate === 'function' &&
    'version' in obj['~standard'] &&
    obj['~standard'].version === 1 &&
    'vendor' in obj['~standard'] &&
    typeof obj['~standard'].vendor === 'string'
  )
}

/**
 * Interface for schema validators that can validate data against schemas.
 *
 * This interface allows you to create custom schema validators that work
 * with different validation libraries (Zod, Valibot, Arktype, etc.).
 */
export interface SchemaValidator {
  /**
   * Validate data against a schema.
   *
   * @template T - The expected type after validation
   * @param schema - The schema to validate against
   * @param data - The data to validate
   * @returns The validated data with the correct type, synchronously or asynchronously
   * @throws {SchemaValidationError} If the data doesn't match the schema
   */
  validate<T>(schema: Schema<T>, data: unknown): T | Promise<T>
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    'then' in value &&
    typeof value.then === 'function'
  )
}

function readValidationResult<T>(
  schema: Schema<T>,
  data: unknown,
  result: StandardSchemaV1.Result<T>
): T {
  if (result.issues) {
    throw new SchemaValidationError(
      JSON.stringify(result.issues),
      schema,
      data,
      undefined,
      result.issues
    )
  }

  return result.value
}

/**
 * Create a default schema validator that supports Standard Schema.
 *
 * This validator works with schemas that implement the Standard Schema
 * interface, including both synchronous and asynchronous validators.
 *
 * @returns A schema validator instance
 *
 * @example
 * ```ts
 * const validator = createSchemaValidator()
 *
 * const parsed = validator.validate(schema, data)
 * ```
 */
export function createSchemaValidator(): SchemaValidator {
  return {
    validate<T>(schema: Schema<T>, data: unknown): T | Promise<T> {
      if (!isStandardSchema(schema)) {
        throw new InvalidSchemaError(
          'Schema must implement the Standard Schema interface',
          schema
        )
      }

      const result = schema['~standard'].validate(data) as
        StandardSchemaV1.Result<T> | PromiseLike<StandardSchemaV1.Result<T>>

      if (isPromiseLike<StandardSchemaV1.Result<T>>(result)) {
        return Promise.resolve(result).then(asyncResult =>
          readValidationResult(schema, data, asyncResult)
        )
      }

      return readValidationResult(schema, data, result)
    },
  }
}
