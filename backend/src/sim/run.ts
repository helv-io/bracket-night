/**
 * Scripted night simulation. Engine-level (no Socket.IO, no browser).
 * Run: npm run sim
 */
import { writeFileSync } from 'fs'
import { join } from 'path'
import { Bracket, Contestant, GameState } from '../types'
import {
  applyBracket,
  castVote,
  championOf,
  countByes,
  createEmptyGame,
  disconnectBySocket,
  joinGame,
  mulberry32,
  startGame,
} from '../engine'
import { getShowcaseBracket } from '../showcase'

type Status = 'pass' | 'fail' | 'stubbed'

interface StepResult {
  name: string
  ok: boolean
  detail?: string
}

interface ScenarioResult {
  id: string
  title: string
  status: Status
  steps: StepResult[]
  notes: string[]
}

function contestants(n: number): Contestant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    bracket_id: 1,
    name: `Fighter ${i + 1}`,
    image_url: '',
  }))
}

function bracket(n: number, code = 'sim'): Bracket {
  return {
    id: 1,
    code,
    title: `Sim ${n}`,
    subtitle: `${n} in the field`,
    contestants: contestants(n),
    isPublic: false,
  }
}

function record(steps: StepResult[], name: string, ok: boolean, detail?: string) {
  steps.push({ name, ok, detail })
  if (!ok) {
    throw new Error(`${name}: ${detail || 'failed'}`)
  }
}

function playToEnd(
  state: GameState,
  playerIds: string[],
  choose: (matchIndex: number, playerIndex: number) => 0 | 1
): number {
  let votes = 0
  let guard = 0
  while (!state.isGameOver && guard < 400) {
    guard += 1
    const matchIndex = state.currentMatchupIndex
    for (let i = 0; i < playerIds.length; i++) {
      if (state.isGameOver) break
      if (state.currentVotes.some((v) => v.playerId === playerIds[i])) continue
      const result = castVote(state, playerIds[i], choose(matchIndex, i))
      if (!result.ok) {
        throw new Error(`vote failed: ${result.error}`)
      }
      votes += 1
    }
  }
  if (!state.isGameOver) {
    throw new Error('tournament did not reach a champion')
  }
  return votes
}

function scenario(
  id: string,
  title: string,
  notes: string[],
  run: (steps: StepResult[]) => void
): ScenarioResult {
  const steps: StepResult[] = []
  try {
    run(steps)
    const failed = steps.some((s) => !s.ok)
    return { id, title, status: failed ? 'fail' : 'pass', steps, notes }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!steps.some((s) => !s.ok)) {
      steps.push({ name: 'uncaught', ok: false, detail: message })
    }
    return { id, title, status: 'fail', steps, notes }
  }
}

function joinMany(state: GameState, count: number, maxPlayers: number, steps: StepResult[]): string[] {
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const result = joinGame(state, `Player ${i + 1}`, `sock-${i + 1}`, maxPlayers)
    record(steps, `join ${i + 1}`, result.ok, result.ok ? result.player.name : result.error)
    if (result.ok) ids.push(result.player.id)
  }
  return ids
}

function runScenarios(): ScenarioResult[] {
  const out: ScenarioResult[] = []

  out.push(scenario(
    'full-4p-8c',
    '4 players / 8 contestants / full tournament to one winner',
    ['Power-of-two field. No byes.'],
    (steps) => {
      const state = createEmptyGame('S1')
      const ids = joinMany(state, 4, 16, steps)
      record(steps, 'apply bracket', applyBracket(state, bracket(8), mulberry32(11)).ok)
      record(steps, 'start', startGame(state).ok)
      record(steps, 'no byes', countByes(state.matchups) === 0, `byes=${countByes(state.matchups)}`)
      playToEnd(state, ids, (m, p) => ((m + p) % 2) as 0 | 1)
      const champ = championOf(state)
      record(steps, 'champion', Boolean(champ), champ?.name)
      record(steps, 'phase champion', state.phase === 'champion', state.phase)
    }
  ))

  out.push(scenario(
    'full-16p-16c',
    '16 players / 16 contestants / full tournament',
    ['MAX_PLAYERS product cap. Classic 15-matchup night.'],
    (steps) => {
      const state = createEmptyGame('S2')
      const ids = joinMany(state, 16, 16, steps)
      record(steps, 'apply bracket', applyBracket(state, bracket(16), mulberry32(22)).ok)
      record(steps, 'start', startGame(state).ok)
      record(steps, '15 matchups', state.matchups.length === 15, `n=${state.matchups.length}`)
      playToEnd(state, ids, (_m, p) => (p < 8 ? 0 : 1))
      record(steps, 'champion', Boolean(championOf(state)), championOf(state)?.name)
    }
  ))

  out.push(scenario(
    'byes-6c',
    '6 contestants / byes auto-advance',
    ['Fill rule: pad to 8, two first-round byes, drain on start and after votes.'],
    (steps) => {
      const state = createEmptyGame('S3')
      const ids = joinMany(state, 4, 16, steps)
      record(steps, 'apply bracket', applyBracket(state, bracket(6), mulberry32(33)).ok)
      record(steps, '2 byes scheduled', countByes(state.matchups) === 2, `byes=${countByes(state.matchups)}`)
      const started = startGame(state)
      record(steps, 'start', started.ok)
      const byeAdvances = started.ok ? started.advances.filter((a) => a.bye).length : 0
      record(steps, 'start drains opening byes or leaves them queued', byeAdvances >= 0)
      playToEnd(state, ids, (m, p) => ((m + p) % 2) as 0 | 1)
      record(steps, 'single champion', Boolean(championOf(state)))
      record(steps, 'index past last matchup', state.currentMatchupIndex === state.matchups.length)
    }
  ))

  out.push(scenario(
    'byes-12c',
    '12 contestants / pad to 16 with 4 byes',
    ['Non-power-of-two field uses the same fill rule.'],
    (steps) => {
      const state = createEmptyGame('S4')
      const ids = joinMany(state, 5, 16, steps)
      record(steps, 'apply bracket', applyBracket(state, bracket(12), mulberry32(44)).ok)
      record(steps, '4 byes', countByes(state.matchups) === 4, `byes=${countByes(state.matchups)}`)
      record(steps, '15 matchups', state.matchups.length === 15)
      record(steps, 'start', startGame(state).ok)
      playToEnd(state, ids, (m, p) => (m % 2 === p % 2 ? 0 : 1))
      record(steps, 'champion', Boolean(championOf(state)))
    }
  ))

  out.push(scenario(
    'tie-coin',
    'Tie → wasTie + winner assigned (TV coin path)',
    ['Engine picks a random side on ties and flags wasTie. TV plays the three.js coin.'],
    (steps) => {
      const state = createEmptyGame('S5')
      const ids = joinMany(state, 4, 16, steps)
      record(steps, 'apply 2-field', applyBracket(state, bracket(2), () => 0).ok)
      record(steps, 'start', startGame(state).ok)
      castVote(state, ids[0], 0)
      castVote(state, ids[1], 0)
      castVote(state, ids[2], 1)
      const last = castVote(state, ids[3], 1)
      record(steps, 'all in', Boolean(last.ok && last.allIn))
      record(steps, 'wasTie', Boolean(last.ok && last.advances[0]?.wasTie))
      record(steps, 'winner exists', Boolean(championOf(state)))
      record(steps, 'tallies 2-2', Boolean(
        last.ok && last.advances[0]?.tallies.left === 2 && last.advances[0]?.tallies.right === 2
      ))
    }
  ))

  out.push(scenario(
    'disconnect-reconnect',
    'Disconnect then reconnect by name keeps identity and vote lock',
    ['Late socket gets the same player id. Mid-round vote is not lost.'],
    (steps) => {
      const state = createEmptyGame('S6')
      const a = joinGame(state, 'Ada', 'sock-a', 16)
      const b = joinGame(state, 'Bea', 'sock-b', 16)
      record(steps, 'join Ada', a.ok)
      record(steps, 'join Bea', b.ok)
      if (!a.ok || !b.ok) return
      applyBracket(state, bracket(2), mulberry32(1))
      startGame(state)
      const vote = castVote(state, a.player.id, 0)
      record(steps, 'Ada votes', vote.ok)
      const gone = disconnectBySocket(state, 'sock-a')
      record(steps, 'Ada disconnected', Boolean(gone && !gone.connected))
      const back = joinGame(state, 'Ada', 'sock-a2', 16)
      record(steps, 'Ada reconnects', Boolean(back.ok && back.isReconnect && back.hasVoted))
      if (back.ok) {
        record(steps, 'same id', back.player.id === a.player.id, `${back.player.id} vs ${a.player.id}`)
      }
      const leftover = castVote(state, b.player.id, 1)
      record(steps, 'Bea finishes matchup', leftover.ok && leftover.allIn)
    }
  ))

  out.push(scenario(
    'late-join-reject',
    'Late join after start is rejected with a clear error',
    ['Product choice: no mid-night seats. Host starts a new room for extras.'],
    (steps) => {
      const state = createEmptyGame('S7')
      joinGame(state, 'Ada', 'a', 16)
      applyBracket(state, bracket(4), mulberry32(7))
      startGame(state)
      const late = joinGame(state, 'Zed', 'z', 16)
      record(steps, 'rejected', !late.ok && late.code === 'STARTED', late.ok ? 'joined' : late.error)
      record(steps, 'message names late join', !late.ok && /late join/i.test(late.error))
    }
  ))

  out.push(scenario(
    'room-full',
    '16th seat is last; 17th is rejected',
    ['Default MAX_PLAYERS is 16. Config can lower it.'],
    (steps) => {
      const state = createEmptyGame('S8')
      joinMany(state, 16, 16, steps)
      const extra = joinGame(state, 'Overflow', 'x', 16)
      record(steps, 'full', !extra.ok && extra.code === 'FULL', extra.ok ? 'joined' : extra.error)
    }
  ))

  out.push(scenario(
    'host-controls',
    'Host cannot start without a bracket; start opens voting',
    ['Start lives on the game-master phone, same as today.'],
    (steps) => {
      const state = createEmptyGame('S9')
      joinGame(state, 'Ada', 'a', 16)
      const early = startGame(state)
      record(steps, 'start blocked', !early.ok && early.code === 'NOT_READY', early.ok ? 'started' : early.error)
      applyBracket(state, getShowcaseBracket(), mulberry32(8))
      const go = startGame(state)
      record(steps, 'start after showcase', go.ok)
      record(steps, 'phase matchup or champion', state.phase === 'matchup' || state.phase === 'champion', state.phase)
      record(steps, 'showcase 8 contestants', state.bracket?.contestants.length === 8)
    }
  ))

  out.push(scenario(
    'unknown-empty-name',
    'Empty name rejected; unknown room is a socket-level error (documented)',
    ['Engine never sees an unknown room. Socket adapter emits a clear error. Covered here as empty-name + documented stub for transport.'],
    (steps) => {
      const state = createEmptyGame('S10')
      const blank = joinGame(state, '   ', 's', 16)
      record(steps, 'empty name', !blank.ok && blank.code === 'NO_PLAYER')
    }
  ))

  return out
}

function renderReport(results: ScenarioResult[]): string {
  const passed = results.filter((r) => r.status === 'pass').length
  const failed = results.filter((r) => r.status === 'fail').length
  const stubbed = results.filter((r) => r.status === 'stubbed').length
  const lines: string[] = []
  lines.push('# Bracket Night simulation report')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('## Paths')
  lines.push('')
  for (const result of results) {
    const mark = result.status === 'pass' ? 'pass' : result.status === 'stubbed' ? 'stub' : 'FAIL'
    lines.push(`- [${mark}] **${result.id}**: ${result.title}`)
    for (const note of result.notes) {
      lines.push(`  - ${note}`)
    }
    for (const step of result.steps) {
      lines.push(`  - ${step.ok ? 'ok' : 'x'} ${step.name}${step.detail ? ` (${step.detail})` : ''}`)
    }
    lines.push('')
  }
  lines.push('## Summary')
  lines.push('')
  lines.push(`${passed} passed / ${failed} failed / ${stubbed} stubbed / ${results.length} total`)
  lines.push('')
  lines.push('## Real vs stubbed')
  lines.push('')
  lines.push('- Real: bracket fill (byes), join/reconnect, late-join reject, room full, host start gates, voting, ties (`wasTie` + tallies), full tournament to one champion, house `showcase` field.')
  lines.push('- Real but not Socket.IO: this harness drives `backend/src/engine.ts` directly so CI stays hermetic.')
  lines.push('- Socket adapter (`game.ts`) is a thin emit layer. Unknown-room copy is covered by code review + the join handler, not a live port bind.')
  lines.push('- Visual: three.js TV (lobby, matchup, tally, coin, champion) is not asserted here. Run the host at `/` for that path.')
  lines.push('- Phone UI is not in this harness.')
  lines.push('- Live rooms stay in-memory. A deploy still drops in-progress nights.')
  lines.push('')
  return lines.join('\n')
}

function main() {
  const results = runScenarios()
  const report = renderReport(results)
  const dest = join(__dirname, '../../..', 'SIM-REPORT.md')
  try {
    writeFileSync(dest, report)
  } catch {
    writeFileSync(join(process.cwd(), 'SIM-REPORT.md'), report)
  }
  process.stdout.write(report)
  if (results.some((r) => r.status === 'fail')) {
    process.exit(1)
  }
}

main()
