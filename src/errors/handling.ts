export function createErrorMessage(context: string, error: unknown): string {
  return `${context}: ${error instanceof Error ? error.message : String(error)}`
}

export function createStandardizedError(
  error: unknown,
  context: string
): Error {
  if (error instanceof Error) {
    return error
  }

  return new Error(`${context}: ${String(error)}`)
}
