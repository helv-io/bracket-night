import { Contestant, Matchup, NightPhase, Player, Vote } from '../../backend/src/types'

export type HostPhase = NightPhase | 'tally' | 'coin'

export type TallyView = {
  left: number
  right: number
  leftName: string
  rightName: string
}

export type TossView = {
  contestants: [Contestant, Contestant]
  winner: 0 | 1
}

export function votesForPlayer(votes: Vote[], playerId: string): boolean {
  return votes.some((v) => v.playerId === playerId)
}

export function matchupLabel(index: number, total: number): string {
  if (total <= 0) return 'Lobby'
  const field = total + 1
  const firstRound = field / 2
  let roundStart = 0
  let roundSize = firstRound
  while (roundSize >= 1) {
    const roundEnd = roundStart + roundSize
    if (index < roundEnd) {
      if (roundSize === 1) return 'Finals'
      if (roundSize === 2) return 'Semifinals'
      if (roundSize === 4) return 'Quarterfinals'
      return `Round of ${roundSize * 2}`
    }
    roundStart = roundEnd
    roundSize /= 2
  }
  return `Match ${index + 1}`
}

export function currentContestants(matchups: Matchup[], index: number): [Contestant | null, Contestant | null] {
  const m = matchups[index]
  return [m?.left || null, m?.right || null]
}

export function connectedCount(players: Player[]): number {
  return players.filter((p) => p.connected).length
}
