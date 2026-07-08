import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { repoRoot, resolveRepoPath } from './data.ts'
import type { ChangedFile, Recommendation } from './types.ts'

const companionTests: Record<string, string[]> = {
  'src/client/index.ts': [
    'src/client/client.test.ts',
    'src/client/client.inference.test.ts',
  ],
  'src/core.ts': [
    'src/request/request.integration.test.ts',
    'src/request/defaults.integration.test.ts',
  ],
  'src/contract/index.ts': [
    'src/contract/contract.test.ts',
    'src/contract/contract.validation.test.ts',
  ],
  'src/schema/index.ts': [
    'src/schema/schema.test.ts',
    'src/schema/schema.integration.test.ts',
  ],
  'src/utils/path.ts': [
    'src/utils/path.test.ts',
    'src/utils/path.integration.test.ts',
    'src/utils/path.typecheck.ts',
  ],
  'src/request/defaults.ts': ['src/request/defaults.integration.test.ts'],
  'src/request/options.ts': [
    'src/request/request.integration.test.ts',
    'src/request/defaults.integration.test.ts',
    'src/request/serialization/serialization.integration.test.ts',
  ],
  'src/request/request.ts': [
    'src/request/request.integration.test.ts',
    'src/request/retry/retry.integration.test.ts',
  ],
  'src/request/url.ts': [
    'src/request/queryParams.integration.test.ts',
    'src/request/request.integration.test.ts',
    'src/utils/path.integration.test.ts',
  ],
  'src/request/retry/retry.ts': ['src/request/retry/retry.integration.test.ts'],
  'src/request/middleware/middleware.ts': [
    'src/request/middleware/middleware.integration.test.ts',
  ],
  'src/request/serialization/serialization.ts': [
    'src/request/serialization/serialization.integration.test.ts',
    'src/request/serialization/serialization.typecheck.ts',
  ],
  'src/request/fetchErrors/fetchErrors.ts': [
    'src/request/fetchErrors/fetchErrors.test.ts',
  ],
  'src/request/abort/abort.ts': ['src/request/abort/abort.test.ts'],
  'src/errors/errors.ts': ['src/errors/errors.test.ts'],
  'src/errors/handling.ts': ['src/errors/errors.test.ts'],
}

export function collectChangedFiles(): ChangedFile[] {
  const files = new Map<string, ChangedFile>()

  for (const entry of gitLines([
    'diff',
    '--name-status',
    '--find-renames',
    '--find-copies',
    'HEAD',
  ])) {
    const parts = entry.split('\t')
    const status = parts[0] ?? ''

    if (status.startsWith('R') || status.startsWith('C')) {
      const nextPath = parts[2]
      if (nextPath) {
        files.set(nextPath, { path: nextPath, status: 'renamed' })
      }
      continue
    }

    const path = parts[1]
    if (!path) {
      continue
    }

    files.set(path, {
      path,
      status:
        status === 'D' ? 'deleted' : status === 'A' ? 'added' : 'modified',
    })
  }

  for (const path of gitLines(['ls-files', '--others', '--exclude-standard'])) {
    files.set(path, { path, status: 'untracked' })
  }

  return [...files.values()].sort((a, b) => a.path.localeCompare(b.path))
}

export function recommendForFiles(files: ChangedFile[]): Recommendation[] {
  const recommendations: Recommendation[] = []

  for (const file of files) {
    addRecommendationsForFile(file, recommendations)
  }

  return dedupeRecommendations(recommendations)
}

export function formatRecommendations(
  files: ChangedFile[],
  recommendations: Recommendation[]
): string {
  if (files.length === 0) {
    return 'No changed files found.'
  }

  const lines = [
    `Changed files: ${files.length}`,
    '',
    ...recommendations.flatMap((recommendation, index) => {
      const command = recommendation.command
        ? `Command: ${recommendation.command.join(' ')}`
        : `Manual: ${recommendation.manual ?? 'review required'}`
      const sample = recommendation.affected.slice(0, 5).join(', ')
      const remaining =
        recommendation.affected.length > 5
          ? `, +${recommendation.affected.length - 5} more`
          : ''

      return [
        `${index + 1}. ${recommendation.fileClass}`,
        `Reason: ${recommendation.reason}`,
        command,
        `Auto-runnable: ${recommendation.autoRunnable ? 'yes' : 'no'}`,
        `Affected: ${recommendation.affected.length} (${sample}${remaining})`,
        '',
      ]
    }),
  ]

  return lines.join('\n').trimEnd()
}

function addRecommendationsForFile(
  file: ChangedFile,
  recommendations: Recommendation[]
): void {
  if (isHarnessFile(file.path)) {
    addCommand(
      recommendations,
      'agent harness',
      'Harness docs, router, adapter, or local skill changed.',
      ['yarn', 'check:agents'],
      file.path
    )
    addCommand(
      recommendations,
      'formatting',
      'Markdown, JSON, or TypeScript harness files should stay formatted.',
      ['yarn', 'format:check'],
      file.path
    )
    return
  }

  if (file.status === 'deleted') {
    addManual(
      recommendations,
      'deleted file',
      'Deleted files need source-aware review before choosing a focused check.',
      'Inspect callers and run the nearest existing focused or package check.',
      file.path
    )
    return
  }

  if (isTypecheckFile(file.path)) {
    addCommand(
      recommendations,
      'type tests',
      'Typecheck fixture changed.',
      ['yarn', 'test:types'],
      file.path
    )
    return
  }

  if (isRuntimeTestFile(file.path)) {
    addCommand(
      recommendations,
      'focused runtime test',
      'Changed test file can run directly with Vitest.',
      ['yarn', 'test:unit', file.path],
      file.path
    )
    return
  }

  if (isSourceFile(file.path)) {
    addCommand(
      recommendations,
      'typecheck',
      'TypeScript runtime source changed.',
      ['yarn', 'test:types'],
      file.path
    )
    addFocusedTests(file.path, recommendations)
    addCommand(
      recommendations,
      'lint',
      'Runtime source changed.',
      ['yarn', 'lint:code'],
      file.path
    )

    if (isPublicSurfaceFile(file.path)) {
      addPackageSurfaceRecommendations(file.path, recommendations)
    }
    return
  }

  if (isPackageOrBuildFile(file.path)) {
    addCommand(
      recommendations,
      'package/build config',
      'Package or build configuration changed.',
      ['yarn', 'test:types'],
      file.path
    )
    addCommand(
      recommendations,
      'package/build config',
      'Package or build configuration changed.',
      ['yarn', 'build'],
      file.path
    )
    addPackageSurfaceRecommendations(file.path, recommendations)
    return
  }

  if (isDocsOrPackagedSkill(file.path)) {
    addCommand(
      recommendations,
      'docs or packaged skill',
      'Documentation or packaged skill changed.',
      ['yarn', 'format:check'],
      file.path
    )
    addManual(
      recommendations,
      'docs or packaged skill',
      'Docs and examples must be checked against source and tests.',
      'Read the source behavior cited by the changed examples.',
      file.path
    )
  }
}

function addFocusedTests(
  sourcePath: string,
  recommendations: Recommendation[]
): void {
  const candidates = findFocusedTests(sourcePath)

  if (candidates.length === 0) {
    addManual(
      recommendations,
      'focused test fallback',
      'No exact focused test file exists for this source file.',
      'Run the nearest existing module test or `yarn test:unit` after source inspection.',
      sourcePath
    )
    return
  }

  for (const testPath of candidates) {
    if (isTypecheckFile(testPath)) {
      addCommand(
        recommendations,
        'type tests',
        'Existing typecheck companion covers this source surface.',
        ['yarn', 'test:types'],
        sourcePath
      )
      continue
    }

    addCommand(
      recommendations,
      'focused runtime test',
      'Existing focused test covers this source surface.',
      ['yarn', 'test:unit', testPath],
      sourcePath
    )
  }
}

function findFocusedTests(sourcePath: string): string[] {
  const explicit = companionTests[sourcePath] ?? []
  const directory = dirname(sourcePath)
  const basename = sourcePath.split('/').pop()?.replace(/\.ts$/, '') ?? ''
  const inferred = [
    join(directory, `${basename}.test.ts`),
    join(directory, `${basename}.integration.test.ts`),
    join(directory, `${basename}.typecheck.ts`),
  ].map(path => path.replaceAll('\\', '/'))

  return [...new Set([...explicit, ...inferred])].filter(path =>
    existsSync(resolveRepoPath(path))
  )
}

function addPackageSurfaceRecommendations(
  path: string,
  recommendations: Recommendation[]
): void {
  addCommand(
    recommendations,
    'public API/package surface',
    'Public exports or package shape may affect consumers.',
    ['yarn', 'test:exports'],
    path
  )
  addManual(
    recommendations,
    'public API/package surface',
    'Package smoke is broad but relevant for public package changes.',
    'Run `yarn package:smoke` when practical.',
    path
  )
}

function addCommand(
  recommendations: Recommendation[],
  fileClass: string,
  reason: string,
  command: string[],
  path: string
): void {
  recommendations.push({
    fileClass,
    reason,
    command,
    autoRunnable: false,
    affected: [path],
  })
}

function addManual(
  recommendations: Recommendation[],
  fileClass: string,
  reason: string,
  manual: string,
  path: string
): void {
  recommendations.push({
    fileClass,
    reason,
    manual,
    autoRunnable: false,
    affected: [path],
  })
}

function dedupeRecommendations(
  recommendations: Recommendation[]
): Recommendation[] {
  const byKey = new Map<string, Recommendation>()

  for (const recommendation of recommendations) {
    const key = JSON.stringify({
      fileClass: recommendation.fileClass,
      reason: recommendation.reason,
      command: recommendation.command,
      manual: recommendation.manual,
    })
    const existing = byKey.get(key)

    if (!existing) {
      byKey.set(key, {
        ...recommendation,
        affected: [...recommendation.affected],
      })
      continue
    }

    existing.affected.push(...recommendation.affected)
  }

  return [...byKey.values()].map(recommendation => ({
    ...recommendation,
    affected: [...new Set(recommendation.affected)].sort(),
  }))
}

function isHarnessFile(path: string): boolean {
  return (
    path === 'AGENTS.md' ||
    path === 'CLAUDE.md' ||
    path.startsWith('.agents/') ||
    path.startsWith('docs/ai-agents/')
  )
}

function isRuntimeTestFile(path: string): boolean {
  return (
    path.startsWith('src/') &&
    (path.endsWith('.test.ts') || path.endsWith('.integration.test.ts'))
  )
}

function isTypecheckFile(path: string): boolean {
  return path.startsWith('src/') && path.endsWith('.typecheck.ts')
}

function isSourceFile(path: string): boolean {
  return (
    path.startsWith('src/') &&
    path.endsWith('.ts') &&
    !path.includes('/testing/') &&
    !path.endsWith('.test.ts') &&
    !path.endsWith('.integration.test.ts') &&
    !path.endsWith('.typecheck.ts')
  )
}

function isPublicSurfaceFile(path: string): boolean {
  return path === 'src/index.ts'
}

function isPackageOrBuildFile(path: string): boolean {
  return (
    path === 'package.json' ||
    path === 'yarn.lock' ||
    path === 'vite.config.ts' ||
    path === 'vitest.config.ts' ||
    path === 'eslint.config.mjs' ||
    path.startsWith('tsconfig') ||
    path.startsWith('scripts/')
  )
}

function isDocsOrPackagedSkill(path: string): boolean {
  return (
    path === 'README.md' ||
    path.startsWith('docs/') ||
    path.startsWith('skills/1000fetches/')
  )
}

function gitLines(args: string[]): string[] {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    const stderr = result.stderr.trim()
    throw new Error(
      `git ${args.join(' ')} failed${stderr ? `: ${stderr}` : ''}`
    )
  }

  return result.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}
