import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  pathExists,
  readJsonFile,
  readRepoText,
  repoRoot,
  resolveRepoPath,
  routerRoot,
} from './data.ts'
import type { CommandReference, References, RulesData } from './types.ts'
import { finish, isPlainObject } from './validation-utils.ts'
import type { ValidationIssue, ValidationResult } from './validation-utils.ts'

export function validateHarness(rules: RulesData): ValidationResult {
  const issues: ValidationIssue[] = []
  const packageJson = readPackageJson(issues)

  validateReferencePaths(rules.references, issues)
  validateCommandScripts(rules.references.commands, packageJson, issues)
  validateAdapterContent(issues)
  validateStableEntrypoints(packageJson, issues)
  validateSchemaContracts(issues)
  validateNoGeneratedRouterBuildOutput(issues)
  validateNoDuplicatedToolSkills(issues)

  return finish(issues)
}

function validateReferencePaths(
  references: References,
  issues: ValidationIssue[]
): void {
  const pathGroups = [
    references.raw,
    references.guides,
    references.skills,
    references.overlays,
    references.adapters,
  ]

  for (const group of pathGroups) {
    for (const [id, value] of Object.entries(group)) {
      if (!pathExists(value)) {
        issues.push({
          label: id,
          message: `referenced path does not exist: ${value}`,
        })
        continue
      }

      const [, anchor] = value.split('#')
      if (anchor && !readRepoText(value).includes(`## ${anchor}`)) {
        issues.push({
          label: id,
          message: `referenced heading not found: ${anchor}`,
        })
      }
    }
  }
}

function validateCommandScripts(
  commands: Record<string, CommandReference>,
  packageJson: Record<string, unknown>,
  issues: ValidationIssue[]
): void {
  const scripts = getScripts(packageJson)

  for (const [id, command] of Object.entries(commands)) {
    if (!Object.hasOwn(scripts, command.script)) {
      issues.push({
        label: id,
        message: `package.json script missing: ${command.script}`,
      })
    }
  }
}

function validateAdapterContent(issues: ValidationIssue[]): void {
  const claudePath = resolveRepoPath('CLAUDE.md')
  if (!existsSync(claudePath)) {
    issues.push({ label: 'adapter:claude', message: 'CLAUDE.md missing' })
    return
  }

  const claude = readRepoText('CLAUDE.md')
  if (!claude.includes('@AGENTS.md')) {
    issues.push({
      label: 'adapter:claude',
      message: 'CLAUDE.md must import AGENTS.md',
    })
  }
  if (!claude.includes('yarn agents:route')) {
    issues.push({
      label: 'adapter:claude',
      message: 'CLAUDE.md must expose route suggestion command',
    })
  }
}

function validateStableEntrypoints(
  packageJson: Record<string, unknown>,
  issues: ValidationIssue[]
): void {
  const requiredPaths = [
    'package.json',
    'src/index.ts',
    'src/client/index.ts',
    'src/core.ts',
    'src/contract/index.ts',
    'src/request',
    'src/testing/handlers.ts',
    'scripts/smoke-exports.mjs',
    'skills/1000fetches/SKILL.md',
    '.agents/router/src/cli.ts',
  ]

  for (const requiredPath of requiredPaths) {
    if (!existsSync(resolveRepoPath(requiredPath))) {
      issues.push({
        label: 'stable-entrypoint',
        message: `missing ${requiredPath}`,
      })
    }
  }

  validatePackageFiles(packageJson, issues)
  validateHarnessScripts(packageJson, issues)
}

function validatePackageFiles(
  packageJson: Record<string, unknown>,
  issues: ValidationIssue[]
): void {
  const files = Array.isArray(packageJson.files) ? packageJson.files : []
  if (!files.includes('skills')) {
    issues.push({
      label: 'package.json.files',
      message: 'packaged skill directory must remain in package files',
    })
  }
  if (!files.includes('docs/BEST_PRACTICES.md')) {
    issues.push({
      label: 'package.json.files',
      message:
        'package should include product docs without publishing docs/ai-agents',
    })
  }
  if (files.includes('docs')) {
    issues.push({
      label: 'package.json.files',
      message: 'package files must not publish agent harness docs via docs/',
    })
  }
}

function validateHarnessScripts(
  packageJson: Record<string, unknown>,
  issues: ValidationIssue[]
): void {
  const scripts = getScripts(packageJson)
  const checkAgents = String(scripts['check:agents'] ?? '')
  const cliScript = String(scripts['agents:cli'] ?? '')

  if (!cliScript.includes('.agents/router/src/cli.ts')) {
    issues.push({
      label: 'package.json.scripts.agents:cli',
      message: 'router CLI script must point to .agents/router/src/cli.ts',
    })
  }
  if (!checkAgents.includes('agents:typecheck')) {
    issues.push({
      label: 'package.json.scripts.check:agents',
      message: 'aggregate harness check must run router typecheck',
    })
  }
  if (!checkAgents.includes('agents:cli check')) {
    issues.push({
      label: 'package.json.scripts.check:agents',
      message: 'aggregate harness check must run router check command',
    })
  }
}

function validateSchemaContracts(issues: ValidationIssue[]): void {
  validateSchemaContract(
    {
      path: '.agents/router/rules.schema.json',
      label: 'rules.schema.json',
      requiredDefs: ['commandReference', 'referenceMap', 'route', 'triggers'],
    },
    issues
  )
  validateSchemaContract(
    {
      path: '.agents/router/evals.schema.json',
      label: 'evals.schema.json',
      requiredDefs: ['evalCase'],
    },
    issues
  )
}

function validateSchemaContract(
  contract: {
    path: string
    label: string
    requiredDefs: string[]
  },
  issues: ValidationIssue[]
): void {
  const schema = readJsonFile(resolveRepoPath(contract.path))

  if (!isPlainObject(schema)) {
    issues.push({
      label: contract.label,
      message: 'schema must be a JSON object',
    })
    return
  }

  if (schema.additionalProperties !== false) {
    issues.push({
      label: contract.label,
      message: 'schema root must reject additional properties',
    })
  }

  const defs = schema.$defs
  if (!isPlainObject(defs)) {
    issues.push({
      label: contract.label,
      message: 'schema must define strict item shapes under $defs',
    })
    return
  }

  for (const defName of contract.requiredDefs) {
    const definition = defs[defName]
    if (!isPlainObject(definition)) {
      issues.push({
        label: contract.label,
        message: `missing $defs.${defName}`,
      })
      continue
    }
    if (definition.additionalProperties !== false) {
      issues.push({
        label: contract.label,
        message: `$defs.${defName} must reject additional properties`,
      })
    }
  }
}

function validateNoGeneratedRouterBuildOutput(issues: ValidationIssue[]): void {
  for (const dirName of ['dist', 'dist-test']) {
    if (existsSync(resolve(routerRoot, dirName))) {
      issues.push({
        label: 'router-build-output',
        message: `.agents/router/${dirName} must not be left as harness source`,
      })
    }
  }
}

function validateNoDuplicatedToolSkills(issues: ValidationIssue[]): void {
  const claudeSkills = resolve(repoRoot, '.claude', 'skills')
  if (existsSync(claudeSkills) && readdirSync(claudeSkills).length > 0) {
    issues.push({
      label: '.claude/skills',
      message: 'canonical local skills belong in .agents/skills',
    })
  }
}

function readPackageJson(issues: ValidationIssue[]): Record<string, unknown> {
  try {
    return JSON.parse(readRepoText('package.json')) as Record<string, unknown>
  } catch (error) {
    issues.push({
      label: 'package.json',
      message: error instanceof Error ? error.message : 'failed to read',
    })
    return {}
  }
}

function getScripts(
  packageJson: Record<string, unknown>
): Record<string, unknown> {
  return isPlainObject(packageJson.scripts) ? packageJson.scripts : {}
}
