export type ReferenceMap = Record<string, string>

export type CommandReference = {
  script: string
  description: string
}

export type References = {
  raw: ReferenceMap
  guides: ReferenceMap
  skills: ReferenceMap
  globalSkills: ReferenceMap
  overlays: ReferenceMap
  adapters: ReferenceMap
  commands: Record<string, CommandReference>
}

export type RouteTriggers = {
  keywords: string[]
  paths: string[]
  regex: string[]
}

export type Route = {
  id: string
  description: string
  priority: number
  skill: string | null
  taskModes: string[]
  triggers: RouteTriggers
  mandatory: string[]
  conditional: string[]
  notSelected: string[]
  verification: string[]
}

export type RulesData = {
  version: number
  fallbackRoute: string
  matching: {
    threshold: number
    taskModePrecedence: string[]
  }
  references: References
  routes: Route[]
}

export type EvalCase = {
  id: string
  prompt: string
  expectedRoute: string
  expectedSkill: string | null
  expectedMandatory: string[]
  expectedConditional: string[]
  expectedNotSelected: string[]
  expectedOverlays: string[]
}

export type EvalsData = {
  cases: EvalCase[]
}

export type RouteResult = {
  route: Route
  skill: string | null
  mandatory: string[]
  conditional: string[]
  notSelected: string[]
  overlays: string[]
  verification: string[]
  score: number
  scoreReasons: string[]
}

export type ChangedFile = {
  path: string
  status: 'added' | 'modified' | 'renamed' | 'deleted' | 'untracked'
}

export type Recommendation = {
  fileClass: string
  reason: string
  command?: string[]
  manual?: string
  autoRunnable: false
  affected: string[]
}
