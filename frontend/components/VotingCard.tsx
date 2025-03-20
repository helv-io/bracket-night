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

  return (
    <div className="p-5 bg-[var(--card-bg)] rounded-xl shadow-lg max-w-md mx-auto">
      <h3 className="flex flex-col items-center text-2xl font-bold text-[var(--accent)] mb-4 gap-1">
        <span>{matchup.left?.name}</span>
        <span className="text-[var(--text)]">🆚</span>
        <span>{matchup.right?.name}</span>
      </h3>
      <div className="flex gap-5 justify-center">
        <button
          onClick={() => handleVote(0)}
          onMouseDown={(e) => e.currentTarget.blur()}
          disabled={voted || !matchup.left}
          className={`flex flex-col items-center p-4 rounded-lg transition-all duration-300 w-40 h-56 ${
            voted || !matchup.left
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:shadow-xl hover:scale-105 bg-gray-800'
          }`}
        >
          {matchup.left?.image_url ? (
            <img
              src={matchup.left.image_url}
              alt={matchup.left.name}
              className="w-24 h-24 rounded-full mb-2 object-cover border-2 border-[var(--accent)]"
            />
          ) : (
            <div className="w-24 h-24 rounded-full mb-2 bg-gray-700 flex items-center justify-center">
              <span className="text-4xl text-[var(--text)]">❓</span>
            </div>
          )}
          <div className="flex-grow flex items-center justify-center w-full">
            <span className="text-lg font-semibold text-[var(--text)] text-center line-clamp-3 hyphens-auto w-full">
              {matchup.left?.name}
            </span>
          </div>
        </button>

        <button
          onClick={() => handleVote(1)}
          onMouseDown={(e) => e.currentTarget.blur()}
          disabled={voted || !matchup.right}
          className={`flex flex-col items-center p-4 rounded-lg transition-all duration-300 w-40 h-56 ${
            voted || !matchup.right
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:shadow-xl hover:scale-105 bg-gray-800'
          }`}
        >
          {matchup.right?.image_url ? (
            <img
              src={matchup.right.image_url}
              alt={matchup.right.name}
              className="w-24 h-24 rounded-full mb-2 object-cover border-2 border-[var(--accent)]"
            />
          ) : (
            <div className="w-24 h-24 rounded-full mb-2 bg-gray-700 flex items-center justify-center">
              <span className="text-4xl text-[var(--text)]">❓</span>
            </div>
          )}
          <div className="flex-grow flex items-center justify-center w-full">
            <span className="text-lg font-semibold text-[var(--text)] text-center line-clamp-3 hyphens-auto w-full">
              {matchup.right?.name}
            </span>
          </div>
        </button>
      </div>
      {voted && (
        <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg shadow text-center">
          <p className="text-lg text-[var(--text)] animate-pulse">Waiting for others to vote...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--accent)] mx-auto mt-2"></div>
        </div>
      )}
    </div>
  )
}

export default VotingCard