export const successStatusValidator: unique symbol = Symbol(
  '1000fetches.successStatusValidator'
)

export function isSuccessfulStatus(status: number): boolean {
  return status >= 200 && status < 300
}
