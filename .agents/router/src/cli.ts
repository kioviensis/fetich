import {
  collectChangedFiles,
  formatRecommendations,
  recommendForFiles,
} from './changed.ts'
import { loadEvals, loadRules } from './data.ts'
import { selectRoute } from './match.ts'
import { runSelfTests } from './self-test.ts'
import {
  formatIssues,
  runRouteEvals,
  validateEvals,
  validateHarness,
  validateRules,
} from './validate.ts'
import type { ValidationResult } from './validate.ts'

const command = process.argv[2] ?? 'help'

try {
  run(command)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}

function run(commandName: string): void {
  const rules = loadRules()
  const evals = loadEvals()

  if (commandName === 'route') {
    const prompt = process.argv
      .slice(3)
      .filter(arg => arg !== '--')
      .join(' ')
    if (!prompt) {
      throw new Error('Usage: yarn agents:route -- "<task prompt>"')
    }
    const result = selectRoute(prompt, rules)
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (commandName === 'validate') {
    assertValid('rules', validateRules(rules))
    assertValid('evals', validateEvals(rules, evals))
    console.log('router data validation passed')
    return
  }

  if (commandName === 'eval') {
    assertValid('route evals', runRouteEvals(rules, evals))
    console.log('route evals passed')
    return
  }

  if (commandName === 'harness') {
    assertValid('harness', validateHarness(rules))
    console.log('harness validation passed')
    return
  }

  if (commandName === 'changed') {
    const files = collectChangedFiles()
    const recommendations = recommendForFiles(files)
    console.log(formatRecommendations(files, recommendations))
    return
  }

  if (commandName === 'self-test') {
    runSelfTests(rules, evals)
    console.log('router self-tests passed')
    return
  }

  if (commandName === 'check') {
    assertValid('rules', validateRules(rules))
    assertValid('evals', validateEvals(rules, evals))
    assertValid('route evals', runRouteEvals(rules, evals))
    assertValid('harness', validateHarness(rules))
    runSelfTests(rules, evals)
    console.log('agent harness checks passed')
    return
  }

  console.log(
    [
      'Usage:',
      '  yarn agents:route -- "<task prompt>"',
      '  yarn agents:validate',
      '  yarn agents:eval',
      '  yarn agents:harness',
      '  yarn agents:self-test',
      '  yarn check:agents',
      '  yarn check:changed',
    ].join('\n')
  )
}

function assertValid(label: string, result: ValidationResult): void {
  if (!result.ok) {
    throw new Error(`${label} failed:\n${formatIssues(result)}`)
  }
}
