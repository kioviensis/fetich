import type { References } from './types.ts'

export type ValidationIssue = {
  label: string
  message: string
}

export type ValidationResult = {
  ok: boolean
  issues: ValidationIssue[]
}

export function finish(issues: ValidationIssue[]): ValidationResult {
  return { ok: issues.length === 0, issues }
}

export function formatIssues(result: ValidationResult): string {
  if (result.ok) {
    return 'ok'
  }

  return result.issues
    .map(issue => `- ${issue.label}: ${issue.message}`)
    .join('\n')
}

export function buildKnownIds(references: References): Set<string> {
  return new Set([
    ...Object.keys(references.raw),
    ...Object.keys(references.guides),
    ...Object.keys(references.skills),
    ...Object.keys(references.globalSkills),
    ...Object.keys(references.overlays),
    ...Object.keys(references.adapters),
    ...Object.keys(references.commands),
  ])
}

export function validateReferenceList(
  ids: string[],
  knownIds: Set<string>,
  label: string,
  issues: ValidationIssue[]
): void {
  const seen = new Set<string>()
  for (const id of ids) {
    if (!knownIds.has(id)) {
      issues.push({ label, message: `unknown reference ${id}` })
    }
    if (seen.has(id)) {
      issues.push({ label, message: `duplicate reference ${id}` })
    }
    seen.add(id)
  }
}

export function assertObjectKeys(
  value: unknown,
  allowedKeys: readonly string[],
  label: string,
  issues: ValidationIssue[]
): void {
  if (!isPlainObject(value)) {
    issues.push({ label, message: 'must be an object' })
    return
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      issues.push({ label, message: `unknown field ${key}` })
    }
  }
}

export function assertString(
  value: unknown,
  label: string,
  issues: ValidationIssue[]
): void {
  if (typeof value !== 'string' || value.length === 0) {
    issues.push({ label, message: 'must be a non-empty string' })
  }
}

export function assertNumber(
  value: unknown,
  label: string,
  issues: ValidationIssue[]
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.push({ label, message: 'must be a finite number' })
  }
}

export function assertStringArray(
  value: unknown,
  label: string,
  issues: ValidationIssue[]
): void {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    issues.push({ label, message: 'must be an array of strings' })
  }
}

export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function compareValue(
  actual: unknown,
  expected: unknown,
  evalId: string,
  field: string,
  issues: ValidationIssue[]
): void {
  if (actual !== expected) {
    issues.push({
      label: evalId,
      message: `${field} mismatch. expected ${String(expected)}, got ${String(actual)}`,
    })
  }
}

export function compareArray(
  actual: string[],
  expected: string[],
  evalId: string,
  field: string,
  issues: ValidationIssue[]
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    issues.push({
      label: evalId,
      message: `${field} mismatch. expected ${JSON.stringify(
        expected
      )}, got ${JSON.stringify(actual)}`,
    })
  }
}
