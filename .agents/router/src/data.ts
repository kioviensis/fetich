import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EvalsData, RulesData } from './types.ts'

const currentFile = fileURLToPath(import.meta.url)
const srcDir = dirname(currentFile)

export const routerRoot = resolve(srcDir, '..')
export const repoRoot = resolve(routerRoot, '..', '..')

export function resolveRepoPath(relativePath: string): string {
  return resolve(repoRoot, relativePath)
}

export function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

export function loadRules(): RulesData {
  return readJsonFile(resolve(routerRoot, 'rules.json')) as RulesData
}

export function loadEvals(): EvalsData {
  return readJsonFile(resolve(routerRoot, 'evals.json')) as EvalsData
}

export function pathExists(relativePath: string): boolean {
  const [filePath] = relativePath.split('#')
  return existsSync(resolveRepoPath(filePath))
}

export function readRepoText(relativePath: string): string {
  const [filePath] = relativePath.split('#')
  return readFileSync(resolveRepoPath(filePath), 'utf8')
}
