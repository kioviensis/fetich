import { selectRoute } from './match.ts'
import type {
  CommandReference,
  EvalsData,
  EvalCase,
  References,
  Route,
  RulesData,
} from './types.ts'
import {
  assertNumber,
  assertObjectKeys,
  assertString,
  assertStringArray,
  buildKnownIds,
  compareArray,
  compareValue,
  finish,
  isPlainObject,
  validateReferenceList,
} from './validation-utils.ts'
import type { ValidationIssue, ValidationResult } from './validation-utils.ts'

const topLevelRuleKeys = [
  'version',
  'fallbackRoute',
  'matching',
  'references',
  'routes',
]

const routeKeys = [
  'id',
  'description',
  'priority',
  'skill',
  'taskModes',
  'triggers',
  'mandatory',
  'conditional',
  'notSelected',
  'verification',
]

const triggerKeys = ['keywords', 'paths', 'regex']

const evalKeys = [
  'id',
  'prompt',
  'expectedRoute',
  'expectedSkill',
  'expectedMandatory',
  'expectedConditional',
  'expectedNotSelected',
  'expectedOverlays',
]

const referenceGroups = [
  'raw',
  'guides',
  'skills',
  'globalSkills',
  'overlays',
  'adapters',
  'commands',
] as const

export function validateRules(rules: RulesData): ValidationResult {
  const issues: ValidationIssue[] = []

  assertObjectKeys(rules, topLevelRuleKeys, 'rules', issues)
  assertNumber(rules.version, 'rules.version', issues)
  assertString(rules.fallbackRoute, 'rules.fallbackRoute', issues)
  validateMatchingShape(rules, issues)
  validateReferencesShape(rules.references, issues)

  if (!Array.isArray(rules.routes)) {
    issues.push({ label: 'rules.routes', message: 'routes must be an array' })
    return finish(issues)
  }

  const routeIds = new Set<string>()
  for (const route of rules.routes) {
    validateRouteShape(route, issues)
    if (routeIds.has(route.id)) {
      issues.push({ label: route.id, message: 'duplicate route id' })
    }
    routeIds.add(route.id)
  }

  if (!routeIds.has(rules.fallbackRoute)) {
    issues.push({
      label: 'rules.fallbackRoute',
      message: `missing fallback route ${rules.fallbackRoute}`,
    })
  }

  validateRouteReferences(rules, issues)

  return finish(issues)
}

export function validateEvals(
  rules: RulesData,
  evals: EvalsData
): ValidationResult {
  const issues: ValidationIssue[] = []
  const knownIds = buildKnownIds(rules.references)
  const routeIds = new Set(rules.routes.map(route => route.id))
  const evalIds = new Set<string>()
  const coveredRoutes = new Set<string>()

  assertObjectKeys(evals, ['cases'], 'evals', issues)

  if (!Array.isArray(evals.cases)) {
    issues.push({ label: 'evals.cases', message: 'cases must be an array' })
    return finish(issues)
  }

  for (const evalCase of evals.cases) {
    validateEvalShape(evalCase, issues)
    validateEvalReferences({
      evalCase,
      evalIds,
      routeIds,
      coveredRoutes,
      knownIds,
      rules,
      issues,
    })
  }

  for (const route of rules.routes) {
    if (!coveredRoutes.has(route.id)) {
      issues.push({ label: route.id, message: 'route has no eval coverage' })
    }
  }

  return finish(issues)
}

export function runRouteEvals(
  rules: RulesData,
  evals: EvalsData
): ValidationResult {
  const issues: ValidationIssue[] = []

  for (const evalCase of evals.cases) {
    const result = selectRoute(evalCase.prompt, rules)
    compareValue(
      result.route.id,
      evalCase.expectedRoute,
      evalCase.id,
      'route',
      issues
    )
    compareValue(
      result.skill,
      evalCase.expectedSkill,
      evalCase.id,
      'skill',
      issues
    )
    compareArray(
      result.mandatory,
      evalCase.expectedMandatory,
      evalCase.id,
      'mandatory',
      issues
    )
    compareArray(
      result.conditional,
      evalCase.expectedConditional,
      evalCase.id,
      'conditional',
      issues
    )
    compareArray(
      result.notSelected,
      evalCase.expectedNotSelected,
      evalCase.id,
      'notSelected',
      issues
    )
    compareArray(
      result.overlays,
      evalCase.expectedOverlays,
      evalCase.id,
      'overlays',
      issues
    )
  }

  return finish(issues)
}

function validateMatchingShape(
  rules: RulesData,
  issues: ValidationIssue[]
): void {
  if (!isPlainObject(rules.matching)) {
    issues.push({
      label: 'rules.matching',
      message: 'matching must be an object',
    })
    return
  }

  assertObjectKeys(
    rules.matching,
    ['threshold', 'taskModePrecedence'],
    'rules.matching',
    issues
  )
  assertNumber(rules.matching.threshold, 'rules.matching.threshold', issues)
  assertStringArray(
    rules.matching.taskModePrecedence,
    'rules.matching.taskModePrecedence',
    issues
  )
}

function validateReferencesShape(
  references: References,
  issues: ValidationIssue[]
): void {
  assertObjectKeys(references, referenceGroups, 'rules.references', issues)

  for (const group of referenceGroups) {
    const value = references[group]
    if (!isPlainObject(value)) {
      issues.push({
        label: `rules.references.${group}`,
        message: 'reference group must be an object',
      })
    }
  }

  for (const [id, command] of Object.entries(references.commands ?? {})) {
    validateCommandReference(id, command, issues)
  }
}

function validateCommandReference(
  id: string,
  command: CommandReference,
  issues: ValidationIssue[]
): void {
  assertObjectKeys(command, ['script', 'description'], id, issues)
  assertString(command.script, `${id}.script`, issues)
  assertString(command.description, `${id}.description`, issues)
}

function validateRouteShape(route: Route, issues: ValidationIssue[]): void {
  assertObjectKeys(route, routeKeys, route.id ?? 'route', issues)
  assertString(route.id, 'route.id', issues)
  assertString(route.description, `${route.id}.description`, issues)
  assertNumber(route.priority, `${route.id}.priority`, issues)
  if (route.skill !== null) {
    assertString(route.skill, `${route.id}.skill`, issues)
  }
  assertStringArray(route.taskModes, `${route.id}.taskModes`, issues)
  assertStringArray(route.mandatory, `${route.id}.mandatory`, issues)
  assertStringArray(route.conditional, `${route.id}.conditional`, issues)
  assertStringArray(route.notSelected, `${route.id}.notSelected`, issues)
  assertStringArray(route.verification, `${route.id}.verification`, issues)
  validateRouteTriggers(route, issues)
}

function validateRouteTriggers(route: Route, issues: ValidationIssue[]): void {
  if (!isPlainObject(route.triggers)) {
    issues.push({
      label: `${route.id}.triggers`,
      message: 'triggers must be an object',
    })
    return
  }

  assertObjectKeys(route.triggers, triggerKeys, `${route.id}.triggers`, issues)
  assertStringArray(
    route.triggers.keywords,
    `${route.id}.triggers.keywords`,
    issues
  )
  assertStringArray(route.triggers.paths, `${route.id}.triggers.paths`, issues)
  assertStringArray(route.triggers.regex, `${route.id}.triggers.regex`, issues)

  for (const regexText of route.triggers.regex) {
    try {
      new RegExp(regexText)
    } catch {
      issues.push({
        label: `${route.id}.triggers.regex`,
        message: `invalid regex ${regexText}`,
      })
    }
  }
}

function validateRouteReferences(
  rules: RulesData,
  issues: ValidationIssue[]
): void {
  const knownIds = buildKnownIds(rules.references)

  for (const route of rules.routes) {
    if (route.skill !== null && !knownIds.has(route.skill)) {
      issues.push({
        label: route.id,
        message: `unknown selected skill ${route.skill}`,
      })
    }

    validateReferenceList(
      route.mandatory,
      knownIds,
      `${route.id}.mandatory`,
      issues
    )
    validateReferenceList(
      route.conditional,
      knownIds,
      `${route.id}.conditional`,
      issues
    )
    validateReferenceList(
      route.notSelected,
      knownIds,
      `${route.id}.notSelected`,
      issues
    )
    validateReferenceList(
      route.verification,
      knownIds,
      `${route.id}.verification`,
      issues
    )

    if (route.skill && !route.mandatory.includes(route.skill)) {
      issues.push({
        label: route.id,
        message: `selected skill ${route.skill} must be mandatory`,
      })
    }
  }
}

function validateEvalShape(
  evalCase: EvalCase,
  issues: ValidationIssue[]
): void {
  assertObjectKeys(evalCase, evalKeys, evalCase.id ?? 'eval', issues)
  assertString(evalCase.id, 'eval.id', issues)
  assertString(evalCase.prompt, `${evalCase.id}.prompt`, issues)
  assertString(evalCase.expectedRoute, `${evalCase.id}.expectedRoute`, issues)
  if (evalCase.expectedSkill !== null) {
    assertString(evalCase.expectedSkill, `${evalCase.id}.expectedSkill`, issues)
  }
  assertStringArray(
    evalCase.expectedMandatory,
    `${evalCase.id}.expectedMandatory`,
    issues
  )
  assertStringArray(
    evalCase.expectedConditional,
    `${evalCase.id}.expectedConditional`,
    issues
  )
  assertStringArray(
    evalCase.expectedNotSelected,
    `${evalCase.id}.expectedNotSelected`,
    issues
  )
  assertStringArray(
    evalCase.expectedOverlays,
    `${evalCase.id}.expectedOverlays`,
    issues
  )
}

function validateEvalReferences({
  evalCase,
  evalIds,
  routeIds,
  coveredRoutes,
  knownIds,
  rules,
  issues,
}: {
  evalCase: EvalCase
  evalIds: Set<string>
  routeIds: Set<string>
  coveredRoutes: Set<string>
  knownIds: Set<string>
  rules: RulesData
  issues: ValidationIssue[]
}): void {
  if (evalIds.has(evalCase.id)) {
    issues.push({ label: evalCase.id, message: 'duplicate eval case id' })
  }
  evalIds.add(evalCase.id)

  if (!routeIds.has(evalCase.expectedRoute)) {
    issues.push({
      label: evalCase.id,
      message: `unknown expected route ${evalCase.expectedRoute}`,
    })
  }
  coveredRoutes.add(evalCase.expectedRoute)

  if (
    evalCase.expectedSkill !== null &&
    !rules.references.skills[evalCase.expectedSkill]
  ) {
    issues.push({
      label: evalCase.id,
      message: `unknown expected skill ${evalCase.expectedSkill}`,
    })
  }

  validateReferenceList(
    evalCase.expectedMandatory,
    knownIds,
    `${evalCase.id}.expectedMandatory`,
    issues
  )
  validateReferenceList(
    evalCase.expectedConditional,
    knownIds,
    `${evalCase.id}.expectedConditional`,
    issues
  )
  validateReferenceList(
    evalCase.expectedNotSelected,
    knownIds,
    `${evalCase.id}.expectedNotSelected`,
    issues
  )
  validateReferenceList(
    evalCase.expectedOverlays,
    knownIds,
    `${evalCase.id}.expectedOverlays`,
    issues
  )

  if (
    evalCase.expectedSkill !== null &&
    !evalCase.expectedMandatory.includes(evalCase.expectedSkill)
  ) {
    issues.push({
      label: evalCase.id,
      message: `expected skill ${evalCase.expectedSkill} must be mandatory`,
    })
  }
}
