import './env'
import fs from 'fs'
import path from 'path'
import { engineCases } from './engine-cases'
import { socketCases, startLiveServer, stopLiveServer } from './socket-cases'
import { SimCase, SimResult } from './types'

const STUBS = [
  {
    id: 'pixels',
    title: 'three.js pixels (TV canvas, coin mesh, camera dollies)',
    note: 'Covered by the host client, not this harness. Run the TV at / to see them.',
  },
  {
    id: 'phone-chrome',
    title: 'Phone layout / wake lock / QR camera',
    note: 'Player UI is real; this harness drives the protocol, not Safari chrome.',
  },
  {
    id: 'sqlite-templates',
    title: 'SQLite template codes besides showcase',
    note: 'Real path via set_field code -> getBracketByCode. Harness uses showcase + inline fields.',
  },
  {
    id: 'persist-rooms',
    title: 'Persisted live rooms',
    note: 'Still in-memory. Restart drops every night. Documented cutover, not a stub of the rule.',
  },
]

const runCase = async (sim: SimCase): Promise<SimResult> => {
  const started = Date.now()
  try {
    await sim.run()
    return { id: sim.id, title: sim.title, layer: sim.layer, ok: true, ms: Date.now() - started }
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error)
    return {
      id: sim.id,
      title: sim.title,
      layer: sim.layer,
      ok: false,
      ms: Date.now() - started,
      error: message,
    }
  }
}

const render = (results: SimResult[]): string => {
  const passed = results.filter(r => r.ok).length
  const lines = [
    '# Bracket Night simulation report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Result: **${passed}/${results.length} passed**`,
    '',
    '## Real (this harness)',
    '',
    '| Status | Layer | Id | Title | ms |',
    '| --- | --- | --- | --- | ---: |',
    ...results.map(r =>
      `| ${r.ok ? 'PASS' : 'FAIL'} | ${r.layer} | \`${r.id}\` | ${r.title} | ${r.ms} |`
    ),
    '',
    '## Labeled stubs / out of band',
    '',
    '| Id | Title | Note |',
    '| --- | --- | --- |',
    ...STUBS.map(s => `| \`${s.id}\` | ${s.title} | ${s.note} |`),
    '',
    '## Failures',
    '',
  ]

  const fails = results.filter(r => !r.ok)
  if (!fails.length) {
    lines.push('None.', '')
  } else {
    for (const fail of fails) {
      lines.push(`### ${fail.id}`, '', '```', fail.error || 'unknown', '```', '')
    }
  }

  lines.push(
    '## Cutover',
    '',
    'Live rooms are an in-process Map. Deploy or restart drops in-progress nights.',
    'Start a new room after the new binary is up.',
    ''
  )
  return lines.join('\n')
}

const main = async () => {
  const results: SimResult[] = []
  for (const sim of engineCases) {
    results.push(await runCase(sim))
  }

  await startLiveServer()
  try {
    for (const sim of socketCases) {
      results.push(await runCase(sim))
    }
  } finally {
    await stopLiveServer()
  }

  const report = render(results)
  const dest = path.join(__dirname, '../../SIM-REPORT.md')
  fs.writeFileSync(dest, report)
  console.log(report)
  if (results.some(r => !r.ok)) process.exit(1)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
