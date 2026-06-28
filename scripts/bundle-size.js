#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'fs'
import { dirname, extname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { gzipSync } from 'zlib'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const distDir = resolve(repoRoot, 'dist')
const requiredLoadLimit = 7 * 1024

function getFileSize(filePath) {
  if (!existsSync(filePath)) return null
  const buffer = readFileSync(filePath)
  const rawSize = buffer.length
  const gzippedSize = gzipSync(buffer).length
  return { rawSize, gzippedSize }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function findStaticImports(filePath) {
  const source = readFileSync(filePath, 'utf8')
  const extension = extname(filePath)
  const imports = []

  if (extension === '.mjs') {
    for (const match of source.matchAll(
      /(?:^|;)\s*import(?!\s*\()\s*(?:["'](\.\/[^"']+)["']|[^;]*?from\s*["'](\.\/[^"']+)["'])/g
    )) {
      imports.push(match[1] ?? match[2])
    }

    for (const match of source.matchAll(
      /(?:^|;)\s*export\s*(?:\*|{[^}]*})\s*from\s*["'](\.\/[^"']+)["']/g
    )) {
      imports.push(match[1])
    }
  }

  if (extension === '.cjs') {
    for (const match of source.matchAll(
      /(?:^|[;,\n]\s*)(?:const|let|var)\s+[^=]+=\s*require\(["'](\.\/[^"']+)["']\)/g
    )) {
      imports.push(match[1])
    }
  }

  return imports
}

function resolveExistingImport(fromFile, importPath) {
  const basePath = resolve(dirname(fromFile), importPath)
  const candidates =
    extname(basePath) === ''
      ? [basePath, `${basePath}.mjs`, `${basePath}.js`, `${basePath}.cjs`]
      : [basePath]

  return candidates.find(candidate => existsSync(candidate))
}

function walkRequiredFiles(entryPath) {
  const pending = [entryPath]
  const visited = new Set()

  while (pending.length > 0) {
    const currentPath = pending.pop()

    if (!currentPath || visited.has(currentPath)) {
      continue
    }

    visited.add(currentPath)

    for (const importPath of findStaticImports(currentPath)) {
      const importedPath = resolveExistingImport(currentPath, importPath)
      if (importedPath) {
        pending.push(importedPath)
      }
    }
  }

  return [...visited].sort()
}

function summarizeFiles(files) {
  return files.reduce(
    (summary, filePath) => {
      const sizes = getFileSize(filePath)

      if (!sizes) return summary

      return {
        rawSize: summary.rawSize + sizes.rawSize,
        gzippedSize: summary.gzippedSize + sizes.gzippedSize,
      }
    },
    { rawSize: 0, gzippedSize: 0 }
  )
}

function relativeDistPath(filePath) {
  return filePath.replace(repoRoot + '/', '')
}

function findEntryFiles() {
  return ['index.mjs', 'index.cjs']
    .map(fileName => resolve(distDir, fileName))
    .filter(filePath => existsSync(filePath))
}

function findOptionalRetryFiles() {
  if (!existsSync(distDir)) {
    return []
  }

  return readdirSync(distDir)
    .filter(fileName => /^retry-.*\.(mjs|js|cjs)$/.test(fileName))
    .map(fileName => resolve(distDir, fileName))
    .sort()
}

function analyzeBundle() {
  console.log('Bundle Size Analysis\n')

  if (!existsSync(distDir)) {
    console.log('No dist directory found.')
    console.log('Run "yarn build" first.')
    process.exit(1)
  }

  const entryFiles = findEntryFiles()

  if (entryFiles.length === 0) {
    console.log('No bundle entry files found.')
    console.log('Expected dist/index.mjs or index.cjs.')
    process.exit(1)
  }

  const entryResults = entryFiles.map(entryPath => {
    const requiredFiles = walkRequiredFiles(entryPath)
    const entrySize = getFileSize(entryPath)
    const requiredSize = summarizeFiles(requiredFiles)

    return {
      entryPath,
      requiredFiles,
      entrySize,
      requiredSize,
    }
  })

  const optionalRetryFiles = findOptionalRetryFiles()
  const optionalRetrySize = summarizeFiles(optionalRetryFiles)

  console.log('Required initial load')
  console.log('+--------+-------------+-------------+-------------+')
  console.log('| Format | Entry gzip  | Required gz | Target      |')
  console.log('+--------+-------------+-------------+-------------+')

  for (const result of entryResults) {
    const format = result.entryPath.endsWith('.mjs') ? 'ESM' : 'CJS'
    const target =
      result.requiredSize.gzippedSize <= requiredLoadLimit
        ? `<= ${formatBytes(requiredLoadLimit)}`
        : `> ${formatBytes(requiredLoadLimit)}`

    console.log(
      `| ${format.padEnd(6)} | ${formatBytes(
        result.entrySize?.gzippedSize ?? 0
      ).padEnd(11)} | ${formatBytes(result.requiredSize.gzippedSize).padEnd(
        11
      )} | ${target.padEnd(11)} |`
    )
  }

  console.log('+--------+-------------+-------------+-------------+')

  console.log('\nRequired files:')
  for (const result of entryResults) {
    const format = result.entryPath.endsWith('.mjs') ? 'ESM' : 'CJS'
    console.log(`   ${format}:`)
    for (const filePath of result.requiredFiles) {
      const sizes = getFileSize(filePath)
      console.log(
        `     - ${relativeDistPath(filePath)} (${formatBytes(
          sizes?.gzippedSize ?? 0
        )} gzip)`
      )
    }
  }

  console.log('\nOptional retry chunks:')
  if (optionalRetryFiles.length === 0) {
    console.log('   none')
  } else {
    for (const filePath of optionalRetryFiles) {
      const sizes = getFileSize(filePath)
      console.log(
        `   - ${relativeDistPath(filePath)} (${formatBytes(
          sizes?.gzippedSize ?? 0
        )} gzip)`
      )
    }
    console.log(
      `   Total optional retry bytes: ${formatBytes(
        optionalRetrySize.gzippedSize
      )} gzip`
    )
  }

  const largestRequired = Math.max(
    ...entryResults.map(result => result.requiredSize.gzippedSize)
  )

  if (largestRequired <= requiredLoadLimit) {
    console.log('\nBundle size target achieved.')
  } else {
    console.log(
      `\nRequired initial load exceeds ${formatBytes(
        requiredLoadLimit
      )}: largest format is ${formatBytes(largestRequired)} gzip.`
    )
    process.exitCode = 1
  }

  console.log('\nComparison:')
  console.log('   Ky: ~2.8KB gzipped')
  console.log('   Axios: ~13KB gzipped')
  console.log(
    `   1000fetches required load: ${formatBytes(largestRequired)} gzipped`
  )
}

try {
  analyzeBundle()
} catch (error) {
  console.error(
    'Error analyzing bundle:',
    error instanceof Error ? error.message : String(error)
  )
  process.exit(1)
}
