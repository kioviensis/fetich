import { PathParameterError } from '../errors'

/**
 * Strips host and optional port from URL, keeping only the path
 */
type StripHost<T extends string> = T extends `${infer _Host}/${infer Path}`
  ? `/${Path}`
  : T

/**
 * Strips protocol and host from full URLs, keeping bare relative paths intact.
 */
type StripUrlOrigin<T extends string> = T extends `${string}://${infer After}`
  ? StripHost<After>
  : T

/**
 * Strips query string from path (e.g., "/users?x=1" -> "/users")
 * Only strips ? that comes after the path, not ? that's part of path parameters
 */
type StripQuery<T extends string> = T extends `${infer Path}?${infer Query}`
  ? Query extends
      | `${string}=${string}`
      | `${string}&${string}`
      | `${string}=${string}&${string}`
    ? Path // Contains query parameters (has = or &)
    : Query extends `/${string}`
      ? T // It's another path segment, not a query
      : Query extends ``
        ? T // It's an optional param marker (?)
        : Path // Plain query params like ?param
  : T

/**
 * Normalizes URL to path only, stripping protocol, host, port, and query
 */
type NormalizePath<T extends string> = StripQuery<StripUrlOrigin<T>>

/**
 * Removes optional suffix from param name (e.g., ":id?" -> "id", ":id" -> "id")
 */
type CleanParamName<S extends string> = S extends `:${infer Name}?`
  ? Name
  : S extends `:${infer Name}`
    ? Name
    : S

/**
 * Extracts required path parameters from a route
 */
type ExtractRequiredRouteParams<T extends string> =
  NormalizePath<T> extends `${infer _Before}:${infer AfterColon}`
    ? AfterColon extends `${infer Param}/${infer Rest}`
      ? Param extends `${string}?`
        ? ExtractRequiredRouteParams<`/${Rest}`>
        : CleanParamName<`:${Param}`> | ExtractRequiredRouteParams<`/${Rest}`>
      : AfterColon extends `${string}?`
        ? never
        : CleanParamName<`:${AfterColon}`>
    : never

/**
 * Extracts optional path parameters from a route
 */
type ExtractOptionalRouteParams<T extends string> =
  NormalizePath<T> extends `${infer _Before}:${infer AfterColon}`
    ? AfterColon extends `${infer Param}/${infer Rest}`
      ? | (Param extends `${string}?` ? CleanParamName<`:${Param}`> : never)
        | ExtractOptionalRouteParams<`/${Rest}`>
      : AfterColon extends `${string}?`
        ? CleanParamName<`:${AfterColon}`>
        : never
    : never

type ExtractRouteParams<T extends string> =
  ExtractRequiredRouteParams<T> | ExtractOptionalRouteParams<T>

type HasNonTrailingOptionalRouteParams<T extends string> = string extends T
  ? false
  : NormalizePath<T> extends `${infer _Before}:${infer AfterColon}`
    ? AfterColon extends `${infer Param}/${infer Rest}`
      ? Param extends `${string}?`
        ? true
        : HasNonTrailingOptionalRouteParams<`/${Rest}`>
      : false
    : false

export type AssertSupportedPath<Path extends string> = string extends Path
  ? Path
  : HasNonTrailingOptionalRouteParams<Path> extends true
    ? never
    : Path

export type HasRequiredParams<T extends string> = [
  ExtractRequiredRouteParams<T>,
] extends [never]
  ? false
  : true

type HasPathParams<T extends string> = [ExtractRouteParams<T>] extends [never]
  ? false
  : true

type Simplify<T> = { [K in keyof T]: T[K] }

/**
 * PathParams type - extracts parameter names and their types
 */
export type PathParams<Path extends string> = [
  AssertSupportedPath<Path>,
] extends [never]
  ? never
  : Simplify<
      {
        [K in ExtractRequiredRouteParams<Path>]: string | number
      } & {
        [K in ExtractOptionalRouteParams<Path>]?: string | number
      }
    >

/**
 * RequirePathParams enforces pathParams when needed
 */
export type RequirePathParams<Path extends string, T> = [
  AssertSupportedPath<Path>,
] extends [never]
  ? never
  : HasRequiredParams<Path> extends true
    ? T & { pathParams: PathParams<Path> }
    : HasPathParams<Path> extends true
      ? T & { pathParams?: PathParams<Path> }
      : T

/**
 * Interpolates parameters into a URL template
 * Similar to React Router's generatePath function
 *
 * @example
 * ```ts
 * const path = generatePath('/users/:id/posts/:postId', { id: '123', postId: '456' });
 * // => '/users/123/posts/456'
 * ```
 */
export function generatePath<Path extends string>(
  path: AssertSupportedPath<Path>,
  ...args: HasRequiredParams<Path> extends true
    ? [params: PathParams<Path>]
    : HasPathParams<Path> extends true
      ? [params?: PathParams<Path>]
      : [params?: PathParams<Path>]
): string
export function generatePath(
  path: string,
  params: Record<string, string | number | undefined> = {}
): string {
  validateSupportedOptionalPath(path, Object.keys(params))

  return path.replace(
    /(^|\/):([^/\s?#]+?)(\?)?(?=\/|$|[?#])/g,
    (_match, prefix: string, paramName: string, optionalMarker?: string) => {
      const isOptional = optionalMarker === '?'

      // Validate parameter name
      if (!/^[a-zA-Z0-9_]+$/.test(paramName)) {
        throw new PathParameterError(
          `Invalid path parameter name: "${paramName}"`,
          path,
          [paramName],
          Object.keys(params)
        )
      }

      // Get and validate parameter value
      const paramValue = params[paramName]

      if (paramValue === undefined) {
        if (isOptional) {
          return ''
        }

        throw new PathParameterError(
          `Missing required path parameter: "${paramName}"`,
          path,
          [paramName],
          Object.keys(params)
        )
      }

      return `${prefix}${encodeURIComponent(String(paramValue))}`
    }
  )
}

function validateSupportedOptionalPath(
  path: string,
  providedParams: string[]
): void {
  const invalidOptionalMatch = path.match(/(^|\/):([^/\s?#]+)\?(?=\/)/)

  if (!invalidOptionalMatch) {
    return
  }

  const [, , paramName] = invalidOptionalMatch

  throw new PathParameterError(
    `Optional path parameter "${paramName}" is not supported here. Optional path parameters are only supported at the end of the path.`,
    path,
    [paramName],
    providedParams
  )
}
