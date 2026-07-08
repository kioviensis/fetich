import { recommendForFiles } from './changed.ts'
import { selectRoute } from './match.ts'
import {
  runRouteEvals,
  validateEvals,
  validateHarness,
  validateRules,
} from './validate.ts'
import type {
  ChangedFile,
  EvalsData,
  Recommendation,
  RulesData,
} from './types.ts'
import type { ValidationResult } from './validate.ts'

export function runSelfTests(rules: RulesData, evals: EvalsData): void {
  assertOk(validateRules(rules), 'validateRules')
  assertOk(validateEvals(rules, evals), 'validateEvals')
  assertOk(runRouteEvals(rules, evals), 'runRouteEvals')
  assertOk(validateHarness(rules), 'validateHarness')

  assertRoute(
    rules,
    'src/request/retry/retry.ts',
    'implement-library-change',
    'path-only source routes to implementation'
  )
  assertRoute(
    rules,
    'add tests for API parsing in src/request/serialization/serialization.ts',
    'test-coverage',
    'test intent beats source domain words'
  )
  assertRoute(
    rules,
    'refactor error helpers',
    'refactor-library-surface',
    'refactor intent beats incidental error words'
  )
  assertRoute(
    rules,
    'document retry behavior',
    'docs-update',
    'docs intent beats retry domain words'
  )

  assertRecommendation(
    [{ path: 'src/request/retry/retry.ts', status: 'modified' }],
    ['yarn', 'test:unit', 'src/request/retry/retry.integration.test.ts'],
    'retry source recommends existing focused retry test'
  )
  assertRecommendation(
    [{ path: 'src/utils/path.typecheck.ts', status: 'modified' }],
    ['yarn', 'test:types'],
    'typecheck file recommends type tests'
  )
  assertRecommendation(
    [{ path: 'AGENTS.md', status: 'modified' }],
    ['yarn', 'check:agents'],
    'harness file recommends harness validation'
  )
  assertManualRecommendation(
    [{ path: 'src/status.ts', status: 'modified' }],
    'focused test fallback',
    'source with no focused test uses manual fallback'
  )
}

function assertRoute(
  rules: RulesData,
  prompt: string,
  expectedRoute: string,
  label: string
): void {
  const actual = selectRoute(prompt, rules).route.id
  if (actual !== expectedRoute) {
    throw new Error(`${label}: expected ${expectedRoute}, got ${actual}`)
  }
}

function assertRecommendation(
  files: ChangedFile[],
  command: string[],
  label: string
): void {
  const recommendations = recommendForFiles(files)
  if (!hasCommand(recommendations, command)) {
    throw new Error(`${label}: missing command ${command.join(' ')}`)
  }
}

function assertManualRecommendation(
  files: ChangedFile[],
  fileClass: string,
  label: string
): void {
  const recommendations = recommendForFiles(files)
  if (
    !recommendations.some(
      recommendation => recommendation.fileClass === fileClass
    )
  ) {
    throw new Error(`${label}: missing manual recommendation ${fileClass}`)
  }
}

function hasCommand(
  recommendations: Recommendation[],
  expectedCommand: string[]
): boolean {
  return recommendations.some(
    recommendation =>
      recommendation.command !== undefined &&
      JSON.stringify(recommendation.command) === JSON.stringify(expectedCommand)
  )
}

function assertOk(result: ValidationResult, label: string): void {
  if (!result.ok) {
    throw new Error(`${label} failed with ${result.issues.length} issues`)
  }
}
