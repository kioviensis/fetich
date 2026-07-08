import { InvalidBaseUrlError } from '../errors'

export function validateAndNormalizeBaseUrl(baseUrl?: string): string {
  if (!baseUrl) {
    return ''
  }

  if (baseUrl.startsWith('/')) {
    return baseUrl.replace(/\/$/, '')
  }

  try {
    new URL(baseUrl)
  } catch {
    throw new InvalidBaseUrlError(
      `Invalid baseUrl: "${baseUrl}". Must be a valid absolute URL or relative path starting with "/".`,
      baseUrl
    )
  }

  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

export function constructUrl(baseUrl: string, requestUrl: string): string {
  if (isAbsoluteUrl(requestUrl)) {
    return requestUrl
  }

  return isAbsoluteUrl(baseUrl)
    ? constructAbsoluteUrl(baseUrl, requestUrl)
    : constructRelativeUrl(baseUrl, requestUrl)
}

export function appendQueryString(url: string, queryString: string): string {
  const normalizedQuery = queryString.startsWith('?')
    ? queryString.slice(1)
    : queryString

  if (!normalizedQuery) {
    return url
  }

  const { path, search, hash } = splitUrl(url)
  const nextSearch = search
    ? `${search}&${normalizedQuery}`
    : `?${normalizedQuery}`

  return `${path}${nextSearch}${hash}`
}

export function assertRequestUrlSupported(
  url: string,
  usesNativeFetch: boolean
): void {
  if (!usesNativeFetch || isAbsoluteUrl(url) || supportsRelativeRequestUrls()) {
    return
  }

  throw new InvalidBaseUrlError(
    `Relative request URL "${url}" requires an absolute baseUrl in non-browser environments. Pass an absolute baseUrl or use a custom fetch implementation.`,
    url
  )
}

function constructAbsoluteUrl(baseUrl: string, requestUrl: string): string {
  const baseUrlObj = new URL(baseUrl)
  const basePath = baseUrlObj.pathname.replace(/\/$/, '')
  const { path, search, hash } = splitUrl(requestUrl)

  if (path.startsWith('/')) {
    baseUrlObj.pathname = basePath + path
  } else if (path) {
    baseUrlObj.pathname = basePath + '/' + path
  }

  if (search) {
    baseUrlObj.search = mergeSearch(baseUrlObj.search, search)
  }

  if (hash) {
    baseUrlObj.hash = hash
  }

  return baseUrlObj.toString()
}

function constructRelativeUrl(baseUrl: string, requestUrl: string): string {
  const {
    path: basePath,
    search: baseSearch,
    hash: baseHash,
  } = splitUrl(baseUrl)
  const {
    path: requestPath,
    search: requestSearch,
    hash: requestHash,
  } = splitUrl(requestUrl)

  const pathname = requestPath
    ? joinPathSegments(basePath, requestPath)
    : basePath || requestPath

  return `${pathname}${mergeSearch(baseSearch, requestSearch)}${
    requestHash || baseHash
  }`
}

function splitUrl(url: string): {
  path: string
  search: string
  hash: string
} {
  const hashIndex = url.indexOf('#')
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex)
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const searchIndex = withoutHash.indexOf('?')

  return {
    path: searchIndex === -1 ? withoutHash : withoutHash.slice(0, searchIndex),
    search: searchIndex === -1 ? '' : withoutHash.slice(searchIndex),
    hash,
  }
}

function mergeSearch(baseSearch: string, requestSearch: string): string {
  if (!baseSearch) {
    return requestSearch
  }

  if (!requestSearch) {
    return baseSearch
  }

  return `${baseSearch}&${requestSearch.slice(1)}`
}

function joinPathSegments(basePath: string, requestPath: string): string {
  if (!basePath) {
    return requestPath.startsWith('/') ? requestPath : `/${requestPath}`
  }

  if (!requestPath) {
    return basePath
  }

  return requestPath.startsWith('/')
    ? `${basePath}${requestPath}`
    : `${basePath}/${requestPath}`
}

function isAbsoluteUrl(url: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)
}

function supportsRelativeRequestUrls(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.location !== 'undefined' &&
    window.location.origin !== 'null'
  )
}
