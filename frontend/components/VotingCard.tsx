import { useState, useEffect } from 'react'
import { Matchup } from '../../backend/src/types'
import { socket } from '../lib/socket'

interface VotingCardProps {
  matchup: Matchup
  gameId: string
  playerName: string
  hasVoted: boolean
}

export default function VotingCard({ matchup, gameId, playerName, hasVoted }: VotingCardProps) {
  const [voted, setVoted] = useState(hasVoted)

  useEffect(() => {
    localStorage.setItem('gameId', gameId)
    localStorage.setItem('playerName', playerName)
  }, [gameId, playerName])

  useEffect(() => {
    setVoted(hasVoted)
  }, [matchup, hasVoted])

  useEffect(() => {
    const storedGameId = localStorage.getItem('gameId')
    const storedPlayerName = localStorage.getItem('playerName')
    if (storedGameId && storedPlayerName) {
      socket.emit('join', { gameId: storedGameId, playerName: storedPlayerName })
    }

    socket.on('vote_status', ({ hasVoted }) => {
      setVoted(hasVoted)
    })

    return () => {
      socket.off('vote_status')
    }
  }, [])

  const handleVote = (choice: number) => {
    if (!voted) {
      socket.emit('vote', { gameId, choice })
      setVoted(true)
    }
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
        </div>
      )}
    </div>
  )
}