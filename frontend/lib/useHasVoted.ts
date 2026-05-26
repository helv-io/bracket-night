import { useMemo } from 'react'

/**
 * Centralized hasVoted logic.
 * Call with stablePlayerId (from localStorage) and current socket.id.
 */
export function useHasVoted(
  currentVotes: Array<{ playerId: string }>,
  stablePlayerId: string | null | undefined,
  currentSocketId: string | undefined
) {
  return useMemo(() => {
    return currentVotes.some(v =>
      v.playerId === currentSocketId ||
      (!!stablePlayerId && v.playerId === stablePlayerId)
    )
  }, [currentVotes, stablePlayerId, currentSocketId])
}


