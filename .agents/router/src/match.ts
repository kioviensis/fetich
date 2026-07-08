import type { Route, RouteResult, RulesData } from './types.ts'

type ScoredRoute = {
  route: Route
  score: number
  reasons: string[]
}

const overlayDetectors: Array<[string, RegExp]> = [
  ['overlay:routing-audit', /\b(routing audit|route audit|read evidence)\b/i],
  ['overlay:dry-run', /\b(dry run|dry-run|design only|proposal|no edits?)\b/i],
  [
    'overlay:verification-only',
    /\b(verify only|verification only|check only|no code changes?)\b/i,
  ],
]

const taskModeDetectors: Array<[string, RegExp]> = [
  [
    'harness',
    /\b(agent harness|check:agents|check:changed|local skill|router eval|sync harness|audit harness|improve harness|create harness|adapter guidance)\b/i,
  ],
  [
    'tests',
    /\b(add|write|cover|improve)\b.*\btests?\b|\b(test coverage|typecheck|expect-type|regression test)\b/i,
  ],
  [
    'refactor',
    /\b(refactor|cleanup|extract|simplify|reorganize)\b|\bwithout changing behavior\b/i,
  ],
  [
    'fix',
    /\b(fix|bug|failing|failure|regression|broken|diagnose|repro|timeout)\b/i,
  ],
  [
    'docs',
    /\b(docs|documentation|document|readme|best practices|examples?)\b/i,
  ],
  [
    'release',
    /\b(public api|export surface|exports?|package smoke|npm pack|release|package\.json|build)\b/i,
  ],
  [
    'implement',
    /\b(add|implement|change|support|create|update|feature|modify)\b/i,
  ],
]

export function selectRoute(prompt: string, rules: RulesData): RouteResult {
  const fallback = getFallbackRoute(rules)
  const overlays = detectOverlays(prompt, rules)
  const taskMode = detectTaskMode(prompt, rules)
  const extractedPaths = extractPaths(prompt)

  const scored = rules.routes
    .filter(route => route.id !== rules.fallbackRoute)
    .map(route => scoreRoute(route, prompt, extractedPaths, taskMode))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.route.priority - a.route.priority
    })

  const best = scored[0]
  const selected =
    best && best.score >= rules.matching.threshold
      ? best
      : { route: fallback, score: 0, reasons: ['fallback below threshold'] }

  return {
    route: selected.route,
    skill: selected.route.skill,
    mandatory: selected.route.mandatory,
    conditional: selected.route.conditional,
    notSelected: selected.route.notSelected,
    overlays,
    verification: selected.route.verification,
    score: selected.score,
    scoreReasons: selected.reasons,
  }
}

function getFallbackRoute(rules: RulesData): Route {
  const fallback = rules.routes.find(route => route.id === rules.fallbackRoute)
  if (!fallback) {
    throw new Error(`Fallback route not found: ${rules.fallbackRoute}`)
  }
  return fallback
}

function detectOverlays(prompt: string, rules: RulesData): string[] {
  return overlayDetectors
    .filter(([overlay, regex]) => {
      return overlay in rules.references.overlays && regex.test(prompt)
    })
    .map(([overlay]) => overlay)
}

function detectTaskMode(prompt: string, rules: RulesData): string | undefined {
  const orderedModes = rules.matching.taskModePrecedence
  for (const mode of orderedModes) {
    const detector = taskModeDetectors.find(([candidate]) => candidate === mode)
    if (detector?.[1].test(prompt)) {
      return mode
    }
  }
  return undefined
}

function scoreRoute(
  route: Route,
  prompt: string,
  extractedPaths: string[],
  taskMode: string | undefined
): ScoredRoute {
  let score = route.priority / 100
  const reasons: string[] = []
  const lowerPrompt = prompt.toLowerCase()

  if (taskMode && route.taskModes.includes(taskMode)) {
    score += 100
    reasons.push(`task mode ${taskMode}`)
  }

  for (const pathPattern of route.triggers.paths) {
    if (extractedPaths.some(path => matchesPathPattern(path, pathPattern))) {
      score += 40
      reasons.push(`path ${pathPattern}`)
    }
  }

  for (const regexText of route.triggers.regex) {
    const regex = new RegExp(regexText, 'i')
    if (regex.test(prompt)) {
      score += 30
      reasons.push(`regex ${regexText}`)
    }
  }

  for (const keyword of route.triggers.keywords) {
    if (containsKeyword(lowerPrompt, keyword.toLowerCase())) {
      score += 8
      reasons.push(`keyword ${keyword}`)
    }
  }

  return { route, score, reasons }
}

function containsKeyword(prompt: string, keyword: string): boolean {
  if (keyword.includes(' ')) {
    return prompt.includes(keyword)
  }

  return new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i').test(prompt)
}

function extractPaths(prompt: string): string[] {
  const matches = prompt.match(
    /(?:^|[\s"'`(])((?:\.?\/)?(?:[\w.-]+\/)*[\w.-]+\.(?:ts|md|json|mjs|js|lock)|(?:\.agents|docs|src|skills|scripts)\/[\w./-]+)/g
  )

  if (!matches) {
    return []
  }

  return matches.map(match => match.trim().replace(/^["'`(]/, ''))
}

function matchesPathPattern(path: string, pattern: string): boolean {
  const normalizedPath = path.replace(/^\.\//, '')
  const regex = globToRegex(pattern)
  return regex.test(normalizedPath)
}

function globToRegex(pattern: string): RegExp {
  const escaped = escapeRegex(pattern)
    .replace(/\\\*\\\*/g, '.*')
    .replace(/\\\*/g, '[^/]*')
  return new RegExp(`^${escaped}$`)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
