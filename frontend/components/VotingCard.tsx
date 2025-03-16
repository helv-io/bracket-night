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
  const [showConfirmation, setShowConfirmation] = useState(false)
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
    setShowConfirmation(true)
  }

  const confirmVote = () => {
    if (voteChoice !== null) {
      socket.emit('vote', { sessionId, choice: voteChoice })
      setVoted(true)
      setShowConfirmation(false)
    }
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
      {showConfirmation && (
        <div style={{ padding: '10px', background: 'white', border: '1px solid black', borderRadius: '5px' }}>
          <p>Are you sure you want to cast your vote? This will stop others from joining the game session.</p>
          <button onClick={confirmVote}>Yes</button>
          <button onClick={() => setShowConfirmation(false)}>No</button>
        </div>
      )}
    </div>
  )
}