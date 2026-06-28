import { createRequire } from 'module'
import { dirname, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const require = createRequire(import.meta.url)

const rootExports = [
  'AbortError',
  'AsyncSchemaValidationError',
  'ContractValidationError',
  'HttpError',
  'InvalidBaseUrlError',
  'InvalidContractError',
  'InvalidSchemaError',
  'MiddlewareError',
  'NetworkError',
  'PathParameterError',
  'SchemaValidationError',
  'SerializationError',
  'TimeoutError',
  'createHttpClient',
  'createSchemaValidator',
]

function assertExportShape(actual, expected, label) {
  const actualKeys = Object.keys(actual).sort()
  const expectedKeys = [...expected].sort()

  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      `${label} exports changed.\nExpected: ${expectedKeys.join(
        ', '
      )}\nActual: ${actualKeys.join(', ')}`
    )
  }
}

const esmRoot = await import(
  pathToFileURL(resolve(packageRoot, 'dist/index.mjs'))
)
const cjsRoot = require(resolve(packageRoot, 'dist/index.cjs'))

assertExportShape(esmRoot, rootExports, 'ESM root')
assertExportShape(cjsRoot, rootExports, 'CJS root')

console.log('Package export smoke checks passed.')
