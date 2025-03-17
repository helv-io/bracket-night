import { useState, useEffect } from 'react'
import { Matchup } from '../../backend/src/types'
import { socket } from '../lib/socket'

interface VotingCardProps {
  matchup: Matchup
  sessionId: string
  playerName: string
  hasVoted: boolean
}

export default function VotingCard({ matchup, sessionId, playerName, hasVoted }: VotingCardProps) {
  const [voted, setVoted] = useState(hasVoted)
  const [voteChoice, setVoteChoice] = useState<number | null>(null)

  useEffect(() => {
    localStorage.setItem('sessionId', sessionId)
    localStorage.setItem('playerName', playerName)
  }, [sessionId, playerName])

  useEffect(() => {
    setVoted(hasVoted)
  }, [matchup, hasVoted])

  useEffect(() => {
    const storedSessionId = localStorage.getItem('sessionId')
    const storedPlayerName = localStorage.getItem('playerName')
    if (storedSessionId && storedPlayerName) {
      socket.emit('join', { sessionId: storedSessionId, playerName: storedPlayerName })
    }
  }, [])

  const handleVote = (choice: number) => {
    setVoteChoice(choice)
    socket.emit('vote', { sessionId, choice })
    setVoted(true)
  }

  return (
    <div style={{ padding: '20px', background: 'var(--card-bg)', borderRadius: '10px' }}>
      <h3>{matchup.left?.name} vs {matchup.right?.name}</h3>
      <div style={{ display: 'flex', gap: '20px' }}>
        <button onClick={() => handleVote(0)} disabled={voted || !matchup.left}>
          Vote <strong>{matchup.left?.name}</strong>
        </button>
        <button onClick={() => handleVote(1)} disabled={voted || !matchup.right}>
          Vote <strong>{matchup.right?.name}</strong>
        </button>
      </div>
      {voted && (
        <div>
          <p>Waiting for others to vote...</p>
          <p>You voted for: {voteChoice === 0 ? matchup.left?.name : matchup.right?.name}</p>
        </div>
      )}
    </div>
  )
}