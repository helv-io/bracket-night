import { randomBytes } from 'crypto'
import {
  Bracket,
  Contestant,
  GameState,
  Matchup,
  MatchupAdvance,
  NightPhase,
  Player,
  Vote,
  VoteTallies,
} from './types'

export type Rng = () => number

export type EngineErrorCode =
  | 'UNKNOWN'
  | 'FULL'
  | 'STARTED'
  | 'INVALID_BRACKET'
  | 'NOT_READY'
  | 'DUP_VOTE'
  | 'BAD_CHOICE'
  | 'NO_PLAYER'

export type EngineFail = {
  ok: false
  error: string
  code: EngineErrorCode
}

export type EngineOk<T extends object = object> = { ok: true } & T

export const MIN_PLAYERS_TO_START = 1
export const MIN_CONTESTANTS = 2
export const MAX_CONTESTANTS = 16

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function nextPowerOfTwo(n: number): number {
  if (n < 2) return 2
  let p = 1
  while (p < n) p <<= 1
  return p
}

export function createEmptyGame(gameId: string): GameState {
  return {
    gameId,
    bracket: null,
    players: [],
    currentMatchupIndex: 0,
    matchups: [],
    currentVotes: [],
    isGameStarted: false,
    isGameOver: false,
    phase: 'lobby',
    lastAdvance: null,
  }
}

export function newPlayerId(): string {
  return randomBytes(8).toString('hex')
}

export function shuffleCopy<T>(items: T[], rng: Rng): T[] {
  const copy = items.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy
}

/**
 * Fill rule: shuffle contestants, pad to the next power of two, then pair
 * real-vs-real first and real-vs-empty (bye) after. A bye auto-advances
 * when that matchup becomes current. Two empties never meet in round 1.
 */
export function createMatchups(contestants: Contestant[], rng: Rng = Math.random): Matchup[] {
  if (contestants.length < MIN_CONTESTANTS) {
    throw new Error(`Need at least ${MIN_CONTESTANTS} contestants`)
  }
  if (contestants.length > MAX_CONTESTANTS) {
    throw new Error(`At most ${MAX_CONTESTANTS} contestants`)
  }

  const field = nextPowerOfTwo(contestants.length)
  const byeCount = field - contestants.length
  const shuffled = shuffleCopy(contestants, rng)
  const firstRoundPairs = field / 2
  const realMatchups = firstRoundPairs - byeCount
  const matchups: Matchup[] = []

  let cursor = 0
  for (let i = 0; i < realMatchups; i++) {
    matchups.push({
      id: matchups.length,
      left: shuffled[cursor],
      right: shuffled[cursor + 1],
      winner: null,
    })
    cursor += 2
  }
  for (let i = 0; i < byeCount; i++) {
    matchups.push({
      id: matchups.length,
      left: shuffled[cursor],
      right: null,
      winner: null,
    })
    cursor += 1
  }

  let remaining = firstRoundPairs / 2
  while (remaining >= 1) {
    for (let i = 0; i < remaining; i++) {
      matchups.push({
        id: matchups.length,
        left: null,
        right: null,
        winner: null,
      })
    }
    remaining /= 2
  }

  return matchups
}

export function fieldSizeFromMatchups(matchups: Matchup[]): number {
  if (matchups.length === 0) return 0
  // first-round count is the only power-of-two that makes total = n-1
  // total matchups = field - 1
  return matchups.length + 1
}

export function isByeMatchup(matchup: Matchup | undefined): boolean {
  if (!matchup) return false
  const sides = [matchup.left, matchup.right].filter(Boolean)
  return sides.length === 1
}

export function isVotableMatchup(matchup: Matchup | undefined): boolean {
  return Boolean(matchup?.left && matchup?.right)
}

export function currentMatchup(state: GameState): Matchup | undefined {
  return state.matchups[state.currentMatchupIndex]
}

function phaseFor(state: GameState): NightPhase {
  if (state.isGameOver) return 'champion'
  if (!state.isGameStarted || !state.bracket) return 'lobby'
  return 'matchup'
}

function refreshPhase(state: GameState) {
  state.phase = phaseFor(state)
}

export function joinGame(
  state: GameState,
  playerName: string,
  socketId: string,
  maxPlayers: number
): EngineOk<{ player: Player; isGameMaster: boolean; hasVoted: boolean; isReconnect: boolean }> | EngineFail {
  const name = playerName.trim()
  if (!name) {
    return { ok: false, code: 'NO_PLAYER', error: 'Enter a display name to join.' }
  }

  const existing = state.players.find((p) => p.name === name)
  if (existing) {
    existing.socketId = socketId
    existing.connected = true
    const hasVoted = state.currentVotes.some((v) => v.playerId === existing.id)
    return { ok: true, player: existing, isGameMaster: state.players[0]?.id === existing.id, hasVoted, isReconnect: true }
  }

  if (state.isGameStarted) {
    return {
      ok: false,
      code: 'STARTED',
      error: 'This night already started. Late join is closed. Watch the TV, or start a new room.',
    }
  }

  if (state.players.length >= maxPlayers) {
    return {
      ok: false,
      code: 'FULL',
      error: `Room is full (${maxPlayers} players).`,
    }
  }

  const player: Player = {
    id: newPlayerId(),
    name,
    socketId,
    connected: true,
  }
  state.players.push(player)
  refreshPhase(state)
  return {
    ok: true,
    player,
    isGameMaster: state.players.length === 1,
    hasVoted: false,
    isReconnect: false,
  }
}

export function disconnectBySocket(state: GameState, socketId: string): Player | null {
  const player = state.players.find((p) => p.socketId === socketId)
  if (!player) return null
  player.connected = false
  player.socketId = ''
  return player
}

export function findGameForSocket(games: Map<string, GameState>, socketId: string): GameState | null {
  for (const game of games.values()) {
    if (game.players.some((p) => p.socketId === socketId)) return game
  }
  return null
}

export function applyBracket(state: GameState, bracket: Bracket, rng: Rng = Math.random): EngineOk | EngineFail {
  if (state.bracket) {
    return { ok: false, code: 'NOT_READY', error: 'A bracket is already locked for this room.' }
  }
  if (state.isGameStarted) {
    return { ok: false, code: 'STARTED', error: 'This night already started.' }
  }
  if (!bracket?.contestants || bracket.contestants.length < MIN_CONTESTANTS) {
    return { ok: false, code: 'INVALID_BRACKET', error: 'Invalid bracket. Need at least two contestants.' }
  }

  state.bracket = bracket
  state.matchups = createMatchups(bracket.contestants, rng)
  state.currentMatchupIndex = 0
  state.currentVotes = []
  state.isGameOver = false
  state.lastAdvance = null
  refreshPhase(state)
  return { ok: true }
}

export function startGame(state: GameState): EngineOk<{ advances: MatchupAdvance[] }> | EngineFail {
  if (state.isGameStarted) {
    return { ok: false, code: 'NOT_READY', error: 'This night already started.' }
  }
  if (!state.bracket || state.matchups.length === 0) {
    return { ok: false, code: 'NOT_READY', error: 'Load a bracket before starting.' }
  }
  if (state.players.length < MIN_PLAYERS_TO_START) {
    return { ok: false, code: 'NOT_READY', error: 'Need at least one player in the room.' }
  }

  state.isGameStarted = true
  const advances = drainByes(state)
  refreshPhase(state)
  return { ok: true, advances }
}

export function playerBySocket(state: GameState, socketId: string): Player | undefined {
  return state.players.find((p) => p.socketId === socketId)
}

export function hasPlayerVoted(state: GameState, playerId: string): boolean {
  return state.currentVotes.some((v) => v.playerId === playerId)
}

export function castVote(
  state: GameState,
  playerId: string,
  choice: number
): EngineOk<{ vote: Vote; allIn: boolean; advances: MatchupAdvance[] }> | EngineFail {
  if (!state.isGameStarted || state.isGameOver) {
    return { ok: false, code: 'NOT_READY', error: 'Voting is not open.' }
  }
  const matchup = currentMatchup(state)
  if (!isVotableMatchup(matchup)) {
    return { ok: false, code: 'NOT_READY', error: 'This matchup is not open for votes.' }
  }
  if (choice !== 0 && choice !== 1) {
    return { ok: false, code: 'BAD_CHOICE', error: 'Vote must be 0 (left) or 1 (right).' }
  }
  if (!state.players.some((p) => p.id === playerId)) {
    return { ok: false, code: 'NO_PLAYER', error: 'You are not in this room.' }
  }
  if (hasPlayerVoted(state, playerId)) {
    return { ok: false, code: 'DUP_VOTE', error: 'You already locked in a vote.' }
  }

  const vote: Vote = { playerId, choice }
  state.currentVotes.push(vote)
  state.phase = 'tally'

  let advances: MatchupAdvance[] = []
  const allIn = state.currentVotes.length === state.players.length
  if (allIn) {
    const first = resolveCurrentMatchup(state)
    advances = first ? [first, ...drainByes(state)] : []
  }
  refreshPhase(state)
  return { ok: true, vote, allIn, advances }
}

export function resolveWinner(
  left: Contestant,
  right: Contestant,
  tallies: VoteTallies,
  rng: Rng
): { winner: Contestant; wasTie: boolean } {
  if (tallies.left > tallies.right) return { winner: left, wasTie: false }
  if (tallies.right > tallies.left) return { winner: right, wasTie: false }
  const winner = rng() < 0.5 ? left : right
  return { winner, wasTie: true }
}

function assignToNext(state: GameState, winner: Contestant) {
  const field = fieldSizeFromMatchups(state.matchups)
  const nextIndex = nextMatchupSlot(state.currentMatchupIndex, field)
  if (nextIndex == null) return
  const next = state.matchups[nextIndex]
  const start = roundStartIndex(state.currentMatchupIndex, field)
  if ((state.currentMatchupIndex - start) % 2 === 0) {
    next.left = winner
  } else {
    next.right = winner
  }
}

export function nextMatchupSlot(currentIndex: number, field: number): number | null {
  const firstRound = field / 2
  let roundStart = 0
  let roundSize = firstRound
  while (roundSize >= 1) {
    const roundEnd = roundStart + roundSize
    if (currentIndex < roundEnd) {
      if (roundSize === 1) return null
      const offset = currentIndex - roundStart
      return roundEnd + Math.floor(offset / 2)
    }
    roundStart = roundEnd
    roundSize /= 2
  }
  return null
}

export function roundStartIndex(currentIndex: number, field: number): number {
  const firstRound = field / 2
  let roundStart = 0
  let roundSize = firstRound
  while (roundSize >= 1) {
    const roundEnd = roundStart + roundSize
    if (currentIndex < roundEnd) return roundStart
    roundStart = roundEnd
    roundSize /= 2
  }
  return 0
}

export function roundLabel(currentIndex: number, field: number): string {
  const firstRound = field / 2
  let roundStart = 0
  let roundSize = firstRound
  while (roundSize >= 1) {
    const roundEnd = roundStart + roundSize
    if (currentIndex < roundEnd) {
      if (roundSize === 1) return 'Finals'
      if (roundSize === 2) return 'SF'
      if (roundSize === 4) return 'QF'
      return `R${roundSize * 2}`
    }
    roundStart = roundEnd
    roundSize /= 2
  }
  return 'Round'
}

function resolveCurrentMatchup(state: GameState, rng: Rng = Math.random): MatchupAdvance | null {
  const matchup = currentMatchup(state)
  if (!matchup || matchup.winner) return null

  let winner: Contestant | null = null
  let wasTie = false
  let bye = false
  let tallies: VoteTallies = { left: 0, right: 0 }

  if (isByeMatchup(matchup)) {
    winner = matchup.left || matchup.right
    bye = true
  } else if (isVotableMatchup(matchup) && matchup.left && matchup.right) {
    tallies = {
      left: state.currentVotes.filter((v) => v.choice === 0).length,
      right: state.currentVotes.filter((v) => v.choice === 1).length,
    }
    const resolved = resolveWinner(matchup.left, matchup.right, tallies, rng)
    winner = resolved.winner
    wasTie = resolved.wasTie
  } else {
    return null
  }

  if (!winner) return null
  matchup.winner = winner
  assignToNext(state, winner)
  state.currentVotes = []
  state.currentMatchupIndex += 1

  if (state.currentMatchupIndex >= state.matchups.length) {
    state.isGameOver = true
    state.phase = 'champion'
  }

  const advance: MatchupAdvance = {
    matchups: state.matchups,
    currentMatchupIndex: state.currentMatchupIndex,
    wasTie,
    bye,
    tallies,
  }
  state.lastAdvance = advance
  return advance
}

function drainByes(state: GameState): MatchupAdvance[] {
  const out: MatchupAdvance[] = []
  while (!state.isGameOver && isByeMatchup(currentMatchup(state))) {
    const advance = resolveCurrentMatchup(state)
    if (!advance) break
    out.push(advance)
  }
  return out
}

export function championOf(state: GameState): Contestant | null {
  if (!state.isGameOver || state.matchups.length === 0) return null
  return state.matchups[state.matchups.length - 1]?.winner || null
}

export function countByes(matchups: Matchup[]): number {
  const field = fieldSizeFromMatchups(matchups)
  const firstRound = field / 2
  return matchups.slice(0, firstRound).filter(isByeMatchup).length
}
