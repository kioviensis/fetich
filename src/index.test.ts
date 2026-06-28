import {
  AbortError,
  ContractValidationError,
  createHttpClient,
  createSchemaValidator,
  HttpError,
  InvalidBaseUrlError,
  InvalidContractError,
  InvalidSchemaError,
  MiddlewareError,
  NetworkError,
  PathParameterError,
  SchemaValidationError,
  SerializationError,
  TimeoutError,
} from './index'
import type {
  ContractableResponse,
  ContractStatus,
  ContractStatusMap,
  CustomFetch,
  ErrorContractStatus,
  ErrorContractStatusMap,
  ExtractableResponse,
  FetchOptions,
  HttpClient,
  HttpClientConfig,
  HttpHeaders,
  HttpMethod,
  HttpRequestOptions,
  InferContractError,
  InferContractSuccess,
  RequestContext,
  RequestDefaults,
  RequestDefaultsContext,
  RequestOptions,
  RequestParamsType,
  ResponseContract,
  ResponseContractBranch,
  ResponseType,
  RetryContext,
  RetryEvent,
  RetryJitter,
  RetryOptions,
  Schema,
  SchemaValidator,
  SerializeBody,
  SuccessContractStatus,
  SuccessContractStatusMap,
  SerializeParams,
} from './index'

it('exports the documented public runtime API from the root entry', () => {
  expect(createHttpClient).toBeTypeOf('function')
  expect(createSchemaValidator).toBeTypeOf('function')

  expect(HttpError).toBeTypeOf('function')
  expect(AbortError).toBeTypeOf('function')
  expect(ContractValidationError).toBeTypeOf('function')
  expect(InvalidBaseUrlError).toBeTypeOf('function')
  expect(InvalidContractError).toBeTypeOf('function')
  expect(InvalidSchemaError).toBeTypeOf('function')
  expect(MiddlewareError).toBeTypeOf('function')
  expect(NetworkError).toBeTypeOf('function')
  expect(PathParameterError).toBeTypeOf('function')
  expect(SchemaValidationError).toBeTypeOf('function')
  expect(SerializationError).toBeTypeOf('function')
  expect(TimeoutError).toBeTypeOf('function')
})

it('exports the documented public type surface from the root entry', () => {
  const headers: HttpHeaders = { accept: 'application/json' }
  const method: HttpMethod = 'GET'
  const params: RequestParamsType = { page: 1, active: true }
  const retryConfig: RetryOptions = { maxRetries: 1 }
  const retryJitter: RetryJitter = 'none'
  const requestOptions: RequestOptions = {
    headers,
    params,
    retry: retryConfig,
  }
  const httpRequestOptions: HttpRequestOptions = { ...requestOptions, method }
  const config: HttpClientConfig = { headers, timeout: 1_000 }
  const fetchImplementation: CustomFetch = fetch
  const fetchOptions: FetchOptions = { keepalive: true }
  const bodySerializer: SerializeBody = body => JSON.stringify(body)
  const paramsSerializer: SerializeParams = values =>
    new URLSearchParams(values as Record<string, string>).toString()
  const requestDefaults: RequestDefaults = { headers, timeout: 1_000 }
  const response: ResponseType<string> = {
    data: 'ok',
    status: 200,
    statusText: 'OK',
    headers,
    method,
    url: 'https://api.example.com',
    raw: new Response('ok'),
  }
  const retryContext: RetryContext = {
    bodyReplayable: true,
    error: new Error('retry'),
    method,
    retryCount: 0,
    url: response.url,
  }
  const retryEvent: RetryEvent = {
    ...retryContext,
    delay: 0,
    nextAttempt: 1,
  }
  const extractable = Promise.resolve(response) as ExtractableResponse<string>
  const contractable = extractable as ContractableResponse<string>
  const schema = {} as Schema<string>
  const statusMap: ContractStatusMap = { default: schema, 201: schema }
  const status: ContractStatus = '201'
  const successStatus: SuccessContractStatus = '304'
  const errorStatus: ErrorContractStatus = '409'
  const successStatusMap: SuccessContractStatusMap = {
    default: schema,
    304: schema,
  }
  const errorStatusMap: ErrorContractStatusMap = {
    default: schema,
    409: schema,
  }
  const branch: ResponseContractBranch<SuccessContractStatus> = successStatusMap
  const contract: ResponseContract = {
    success: branch,
    error: errorStatusMap,
  }
  const successData = undefined as unknown as InferContractSuccess<
    typeof contract
  >
  const errorData = undefined as unknown as InferContractError<typeof contract>
  const validator: SchemaValidator = createSchemaValidator()
  const context: RequestContext = {
    url: response.url,
    method,
    headers: new Headers(headers),
    fetchOptions: {},
  }
  const defaultsContext: RequestDefaultsContext = {
    path: '/users',
    resolvedPath: '/users',
    method,
    hasBody: false,
    requestOptions: {},
    baseUrl: '',
    headers,
    timeout: 1_000,
  }
  const client: HttpClient = createHttpClient()

  expect({
    client,
    config,
    context,
    defaultsContext,
    errorStatus,
    errorStatusMap,
    fetchImplementation,
    fetchOptions,
    httpRequestOptions,
    paramsSerializer,
    retryEvent,
    retryJitter,
    requestDefaults,
    bodySerializer,
    branch,
    contract,
    schema,
    status,
    statusMap,
    successStatus,
    successStatusMap,
    successData,
    errorData,
    contractable,
    validator,
  }).toBeDefined()
})
