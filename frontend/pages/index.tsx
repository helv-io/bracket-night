/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { isMobile } from 'react-device-detect'
import { QRCodeSVG } from 'qrcode.react'
import Confetti from 'react-confetti'
import { socket } from '../lib/socket'
import Bracket from '../components/Bracket'
import { Matchup, Player, Bracket as BracketType, Vote } from '../../backend/src/types'
import CoinToss from '@/components/CoinToss'

const Home = () => {
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
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)] p-4 md:p-8 flex flex-col items-center justify-between">
      {/* Background Music */}
      <audio src="/background.ogg" autoPlay loop />
  
      {/* Logo */}
      <div className="logo-container">
        <img src="/bracket-night-gold.svg" alt="Logo" className="logo border-40 border-transparent" />
        {bracket && (
          <>
            <h1
              className="text-3xl md:text-4xl lg:text-5xl font-bold"
              style={{ textShadow: "2px 2px 4px var(--accent)" }}
            >
              {bracket.title}
            </h1>
            <h2
              className="text-xl md:text-2xl lg:text-3xl mt-2"
              style={{ textShadow: "1px 1px 2px var(--accent)" }}
            >
              {bracket.subtitle}
            </h2>
          </>
        )}
      </div>
  
      {/* Main Content */}
      <div className="w-full flex-grow flex flex-col items-center justify-center text-center relative">
        {matchups.length > 0 && (
          <Bracket matchups={matchups} currentMatchupIndex={currentMatchupIndex} />
        )}
        {matchups.length === 0 && (
          <div>
            <h1
              className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4"
              style={{ textShadow: "2px 2px 4px var(--accent)" }}
            >
              🏆 Welcome to Bracket Night 🏆
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl max-w-2xl mx-auto">
              ⚔️ The arena is almost set for an epic clash. ⚔️
            </p>
            <p className="text-lg md:text-xl lg:text-2xl max-w-2xl mx-auto">
              ⚔️ Only one will rise victorious. ⚔️
            </p>
          </div>
        )}
      </div>
  
      {/* QR Code */}
      {!isGameStarted && gameId && (
        <div className="text-center qr-container">
          <div className="border-2 border-dashed border-[var(--accent)] p-4 bg-white rounded-lg shadow-lg inline-block transition-transform duration-300 hover:scale-105 hover:shadow-[0_0_15px_var(--accent)]">
            <p className="text-sm text-gray-600 mb-1">
              Scan this code to join
            </p>
            <div className="w-24 md:w-32 lg:w-48 mx-auto">
              <QRCodeSVG
                value={`${window.location.origin}/join?game=${gameId}`}
                imageSettings={{ src: "/bn-logo-gold.svg", height: 64, width: 64, excavate: true }}
                size={256}
                className="w-full h-auto"
              />
            </div>
            <div className="mt-2">
              <a
                href={`${window.location.origin}/join?game=${gameId}`}
                target="_blank"
                className="text-xl md:text-2xl font-bold text-[var(--accent)] bg-[var(--card-bg)] px-3 py-1 rounded-md shadow-md hover:text-[var(--winner-highlight)] transition-colors duration-200"
              >
                {gameId}
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-4 justify-center mt-4">
            {players.length === 0 && (
              <div className="px-3 py-1 border border-gray-300 rounded text-gray-500 bg-[var(--card-bg)]">
                It’s empty around here... 👻
              </div>
            )}
            {players.length > 0 && (
              <div className="px-3 py-1 border border-[var(--accent)] rounded text-[var(--text)] bg-[var(--card-bg)] shadow-sm hover:bg-[var(--accent)]/10 transition-colors duration-200">
                {players.length} Player{players.length > 1 ? 's' : ''} joined!
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Coin Toss */}
      {isGameStarted && matchups && (
        <div style={{ position: 'absolute', right: 0, bottom: 0 }} >
          <CoinToss contestants={[matchups[0].left!, matchups[1].right!]} leftOrRight={Math.round(Math.random()) as 0|1} />
        </div>
      )}
  
      {/* Player Voting Status (Centered) */}
      <div className="w-full flex justify-center">
        {isGameStarted && !isGameOver && (
          <div className="mt-4">
            <ul className="list-none flex flex-wrap gap-4 justify-center">
              {players.map((player) => {
                const hasVoted = currentVotes.some(
                  (vote) => vote.playerId === player.id
                )
                return (
                  <li
                    key={player.id}
                    className={`flex items-center gap-2 px-3 py-1 rounded ${
                      hasVoted ? "bg-[var(--accent)]/20" : "bg-[var(--card-bg)]"
                    } transition duration-200 hover:shadow-md`}
                  >
                    <span
                      className={`${
                        hasVoted
                          ? "text-[var(--winner-highlight)] font-bold"
                          : "text-gray-400"
                      }`}
                    >
                      {player.name}
                    </span>
                    <span
                      className={`ml-2 px-2 py-1 text-xs rounded-full ${
                        hasVoted
                          ? "bg-[var(--winner-highlight)] text-white"
                          : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      {hasVoted ? "Voted" : "Pending"}
                    </span>
                  </li>
                )
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

export default Home