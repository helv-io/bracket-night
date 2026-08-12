/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from 'react'
import { Matchup } from '../../backend/src/types'
import { socket } from '../lib/socket'

interface VotingCardProps {
  matchup: Matchup
  gameId: string
  playerName: string
  hasVoted: boolean
}

const VotingCard = ({ matchup, gameId, playerName, hasVoted }: VotingCardProps) => {
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

  const renderChoice = (side: 0 | 1) => {
    const contestant = side === 0 ? matchup.left : matchup.right
    const disabled = voted || !contestant

    return (
      <button
        type="button"
        onClick={() => handleVote(side)}
        onMouseDown={(e) => e.currentTarget.blur()}
        disabled={disabled}
        className={[
          'vote-choice',
          disabled ? 'is-disabled' : '',
          voted ? 'has-voted' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={contestant ? `Vote for ${contestant.name}` : 'Unavailable'}
      >
        <div className="vote-choice-frame">
          {contestant?.image_url ? (
            <img src={contestant.image_url} alt={contestant.name} className="vote-choice-img" />
          ) : (
            <div className="vote-choice-fallback">?</div>
          )}
        </div>
        <span className="vote-choice-name">{contestant?.name || 'TBD'}</span>
        <span className="vote-choice-cta">{voted ? 'Locked in' : 'Tap to vote'}</span>
      </button>
    )
  }

  return (
    <div className="bn-card vote-card">
      <div className="vote-card-header">
        <p className="bn-display vote-eyebrow">Your vote</p>
        <h3 className="vote-title">
          <span>{matchup.left?.name || 'TBD'}</span>
          <span className="vote-vs">VS</span>
          <span>{matchup.right?.name || 'TBD'}</span>
        </h3>
      </div>

      <div className="vote-choices">
        {renderChoice(0)}
        {renderChoice(1)}
      </div>

      {voted && (
        <div className="vote-waiting">
          <p>Waiting for the rest of the room…</p>
          <div className="vote-spinner" aria-hidden />
        </div>
      )}
    </div>
  )
}

export default VotingCard
