/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { isMobile } from 'react-device-detect'
import { QRCodeSVG } from 'qrcode.react'
import Confetti from 'react-confetti'
import { socket } from '../lib/socket'
import Bracket from '../components/Bracket'
import { Matchup, Player, Bracket as BracketType, Vote } from '../../backend/src/types'

export default function Home() {
  // Declare router for mobile navigation
  const router = useRouter()
  
  const [gameId, setGameId] = useState<string | null>(null)
  const [bracket, setBracket] = useState<BracketType | null>(null)
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [currentMatchupIndex, setCurrentMatchupIndex] = useState(0)
  const [players, setPlayers] = useState<Player[]>([])
  const [isGameOver, setIsGameOver] = useState(false)
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [currentVotes, setCurrentVotes] = useState<Vote[]>([])
  const gameIdRef = useRef(gameId)
  
  useEffect(() => {
    gameIdRef.current = gameId
  }, [gameId])

  useEffect(() => {
    // Navigate to new game page if on mobile
    if (isMobile) {
      router.push('/new')
      return
    }
  
    // Create a new game on page load
    socket.emit('create_game')
    
    // When a matchup is advanced, update matchups and current matchup index
    socket.on('matchup_advanced', ({ matchups, currentMatchupIndex }) => {
      setMatchups(matchups)
      setCurrentMatchupIndex(currentMatchupIndex)
      setCurrentVotes([])
      
      // Check if game is over, aka last matchup is complete
      if (currentMatchupIndex === 15) setIsGameOver(true)
    })
    
    socket.on('game_state', ({ gameId, bracket, matchups, currentMatchupIndex, players, currentVotes, isGameStarted, isGameOver }) => {
      setGameId(gameId)
      setBracket(bracket)
      setMatchups(matchups)
      setCurrentMatchupIndex(currentMatchupIndex)
      setPlayers(players)
      setCurrentVotes(currentVotes)
      setIsGameStarted(isGameStarted)
      setIsGameOver(isGameOver)
    })
  
    return () => {
      socket.off('matchup_advanced')
    }
  }, [router])

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--text)] p-4">
      {/* Background Music */}
      <audio src="/background.ogg" autoPlay loop />
  
      {/* Logo */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-10">
        <img
          src="/bracket-night-gold.svg"
          alt="Bracket Night"
          className="w-[580px] h-auto drop-shadow-[0_0_10px_var(--accent)]"
        />
      </div>
  
      {/* Title and Subtitle */}
      <div className="absolute top-[25vh] left-1/2 transform -translate-x-1/2 z-10 text-center">
        {bracket && (
          <>
            <h1
              className="text-4xl md:text-5xl font-bold"
              style={{ textShadow: '2px 2px 4px var(--accent)' }}
            >
              {bracket.title}
            </h1>
            <h2
              className="text-2xl md:text-3xl mt-2"
              style={{ textShadow: '1px 1px 2px var(--accent)' }}
            >
              {bracket.subtitle}
            </h2>
          </>
        )}
      </div>
  
      {/* Bracket or Loading Message */}
      <div className="absolute inset-0 flex justify-center items-center z-0">
        {matchups.length > 0 ? (
          <Bracket matchups={matchups} currentMatchupIndex={currentMatchupIndex} />
        ) : (
          <div className="text-center px-4">
            <h1 className="text-3xl md:text-6xl font-bold mb-4" style={{ textShadow: '2px 2px 4px var(--accent)' }}>
              🏆 Welcome to Bracket Night! 🏆
            </h1>
            <p className="text-2xl md:text-3xl max-w-2xl mx-auto">
              Get ready for an epic tournament where champions clash and only one emerges victorious. Hang tight as the brackets load... ⚔️
            </p>
          </div>
        )}
      </div>
  
      {/* QR Code and Game Info */}
      <div className="absolute bottom-[5vh] left-1/2 transform -translate-x-1/2 z-10 text-center">
        {!isGameStarted && gameId && (
          <>
            <div className="border-2 border-dashed border-[var(--accent)] p-4 bg-white rounded-lg shadow-lg inline-block transition-transform hover:scale-105">
              <QRCodeSVG
                value={`${window.location.origin}/join?game=${gameId}`}
                imageSettings={{ src: '/bn-logo-gold.svg', height: 24, width: 24, excavate: true }}
                size={150}
              />
              <div className="mt-2">
                <a
                  href={`${window.location.origin}/join?game=${gameId}`}
                  target="_blank"
                  className="text-2xl font-bold text-[var(--accent)] hover:text-[var(--winner-highlight)] transition-colors duration-200"
                >
                  {gameId}
                </a>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {players.length === 0 ? (
                <div className="px-3 py-1 border border-gray-300 rounded text-gray-500 bg-[var(--card-bg)]">
                  It’s empty around here... 👻
                </div>
              ) : (
                players.map(player => (
                  <div
                    key={player.id}
                    className="px-3 py-1 border border-[var(--accent)] rounded text-[var(--text)] bg-[var(--card-bg)] shadow-sm"
                  >
                    {player.name}
                  </div>
                ))
              )}
            </div>
          </>
        )}
        {isGameStarted && (
          <div className="mt-4">
            <ul className="list-none flex flex-wrap gap-4 justify-center">
              {players.map(player => {
                const hasVoted = currentVotes.some(vote => vote.playerId === player.id);
                return (
                  <li
                    key={player.id}
                    className={`flex items-center gap-2 px-3 py-1 rounded ${
                      hasVoted ? 'bg-[var(--accent)]/20' : 'bg-[var(--card-bg)]'
                    } transition duration-200`}
                  >
                    <span
                      className={`${
                        hasVoted ? 'text-[var(--winner-highlight)] font-bold' : 'text-gray-400'
                      }`}
                    >
                      {player.name}
                    </span>
                    <span
                      className={`ml-2 px-2 py-1 text-xs rounded-full ${
                        hasVoted
                          ? 'bg-[var(--winner-highlight)] text-white'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {hasVoted ? 'Voted' : 'Pending'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
  
      {/* Confetti */}
      {isGameOver && <Confetti />}
    </div>
  )
}