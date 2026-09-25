export function roundLabel(index: number): string {
  if (index < 8) return 'Round of 16'
  if (index < 12) return 'Quarterfinal'
  if (index < 14) return 'Semifinal'
  if (index === 14) return 'Final'
  return 'Champion'
}

export function resumeCopy(phase: string, hasVoted: boolean): string {
  if (phase === 'lobby') return "You're back in the lobby. Same seat."
  if (phase === 'coin') return "You're back. The coin is in the air — watch the TV."
  if (phase === 'champion') return "You're back. The night already has a champion."
  if (hasVoted) return "You're back. Your vote is still locked in."
  return "You're back. This matchup still needs your vote."
}
