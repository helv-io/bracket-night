import { useState, useEffect } from 'react'
import { Matchup } from '../../backend/src/types'
import { socket } from '../lib/socket'

interface VotingCardProps {
  matchup: Matchup
  sessionId: string
  hasVoted: boolean
}

export default function VotingCard({ matchup, sessionId, hasVoted }: VotingCardProps) {
  const [voted, setVoted] = useState(hasVoted)

  // Reset voted state when matchup or hasVoted changes
  useEffect(() => {
    setVoted(hasVoted)
  }, [matchup, hasVoted])

  const handleVote = (choice: number) => {
    socket.emit('vote', { sessionId, choice })
    setVoted(true)
  }

  return (
    <div style={{ padding: '20px', background: 'var(--card-bg)', borderRadius: '10px' }}>
      <h3>{matchup.left?.name} vs {matchup.right?.name}</h3>
      <div style={{ display: 'flex', gap: '20px' }}>
        <button onClick={() => handleVote(0)} disabled={voted || !matchup.left}>
          Vote {matchup.left?.name}
        </button>
        <button onClick={() => handleVote(1)} disabled={voted || !matchup.right}>
          Vote {matchup.right?.name}
        </button>
      </div>
      {voted && <p>Waiting for others to vote...</p>}
    </div>
  )
}