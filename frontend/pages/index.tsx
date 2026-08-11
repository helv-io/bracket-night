/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { isMobile } from 'react-device-detect'
import { QRCodeSVG } from 'qrcode.react'
import Confetti from 'react-confetti'
import { socket } from '../lib/socket'
import Bracket from '../components/Bracket'
import { Matchup, Player, Bracket as BracketType, Vote, Contestant } from '../../backend/src/types'
import CoinToss from '@/components/CoinToss'

type ActiveToss = {
  contestants: [Contestant, Contestant]
  winner: 0 | 1
  autoStart: boolean
}

const Home = () => {
  const router = useRouter()

  const [gameId, setGameId] = useState<string | null>(null)
  const [bracket, setBracket] = useState<BracketType | null>(null)
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [currentMatchupIndex, setCurrentMatchupIndex] = useState(0)
  const [players, setPlayers] = useState<Player[]>([])
  const [isGameOver, setIsGameOver] = useState(false)
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [currentVotes, setCurrentVotes] = useState<Vote[]>([])
  const [activeToss, setActiveToss] = useState<ActiveToss | null>(null)
  const gameIdRef = useRef(gameId)
  const currentVotesRef = useRef(currentVotes)

  useEffect(() => {
    gameIdRef.current = gameId
  }, [gameId])

  useEffect(() => {
    currentVotesRef.current = currentVotes
  }, [currentVotes])

  useEffect(() => {
    if (isMobile) {
      router.push('/new')
      return
    }

    socket.emit('create_game')

    socket.on('matchup_advanced', ({ matchups, currentMatchupIndex }) => {
      const votes = currentVotesRef.current
      const leftVotes = votes.filter((v) => v.choice === 0).length
      const rightVotes = votes.filter((v) => v.choice === 1).length
      const prevIndex = currentMatchupIndex - 1
      const wasTie = votes.length > 0 && leftVotes === rightVotes

      if (wasTie && prevIndex >= 0) {
        const completed = matchups[prevIndex] as Matchup
        if (completed?.left && completed?.right && completed.winner) {
          const winnerSide: 0 | 1 =
            completed.winner.id === completed.left.id ? 0 : 1
          setActiveToss({
            contestants: [completed.left, completed.right],
            winner: winnerSide,
            autoStart: true,
          })
        }
      }

      setMatchups(matchups)
      setCurrentMatchupIndex(currentMatchupIndex)
      setCurrentVotes([])

      if (currentMatchupIndex === 15) setIsGameOver(true)
    })

    socket.on(
      'game_state',
      ({
        gameId,
        bracket,
        matchups,
        currentMatchupIndex,
        players,
        currentVotes,
        isGameStarted,
        isGameOver,
      }) => {
        setGameId(gameId)
        setBracket(bracket)
        setMatchups(matchups)
        setCurrentMatchupIndex(currentMatchupIndex)
        setPlayers(players)
        setCurrentVotes(currentVotes)
        setIsGameStarted(isGameStarted)
        setIsGameOver(isGameOver)
      }
    )

    return () => {
      socket.off('matchup_advanced')
      socket.off('game_state')
    }
  }, [router])

  const clearToss = useCallback(() => setActiveToss(null), [])

  const startManualToss = () => {
    const current = matchups[currentMatchupIndex]
    if (!current?.left || !current?.right) return
    const winner = (Math.random() < 0.5 ? 0 : 1) as 0 | 1
    setActiveToss({
      contestants: [current.left, current.right],
      winner,
      autoStart: true,
    })
  }

  return (
    <div className="bn-page bn-page--stadium min-h-screen text-[var(--text)] p-4 md:p-8 flex flex-col items-center justify-between">
      <audio src="/background.ogg" autoPlay loop />

      <div className="logo-container">
        <img
          src="/bracket-night-gold.svg"
          alt="Bracket Night"
          className="logo border-40 border-transparent"
        />
        {bracket && (
          <>
            <h1 className="bn-display text-3xl md:text-4xl lg:text-5xl">
              {bracket.title}
            </h1>
            <h2 className="text-xl md:text-2xl lg:text-3xl mt-1 text-[var(--text-muted)]">
              {bracket.subtitle}
            </h2>
          </>
        )}
      </div>

      <div className="w-full flex-grow flex flex-col items-center justify-center text-center relative">
        {matchups.length > 0 && (
          <Bracket matchups={matchups} currentMatchupIndex={currentMatchupIndex} />
        )}
        {matchups.length === 0 && (
          <div className="bn-card px-8 py-10 max-w-2xl">
            <h1 className="bn-display text-4xl md:text-5xl text-[var(--gold-bright)] mb-3">
              Welcome to Bracket Night
            </h1>
            <p className="text-lg md:text-xl text-[var(--text-muted)]">
              The arena is almost set. Scan in, pick your fighter energy, and let the room decide.
            </p>
          </div>
        )}
      </div>

      {!isGameStarted && gameId && (
        <div className="text-center qr-container">
          <div className="bn-card p-4 inline-block">
            <p className="text-sm text-[var(--text-muted)] mb-2 tracking-wide uppercase">
              Scan to join
            </p>
            <div className="w-24 md:w-32 lg:w-48 mx-auto bg-white rounded-lg p-2">
              <QRCodeSVG
                value={`${window.location.origin}/join?game=${gameId}`}
                imageSettings={{
                  src: '/bn-logo-gold.svg',
                  height: 48,
                  width: 48,
                  excavate: true,
                }}
                size={256}
                className="w-full h-auto"
              />
            </div>
            <div className="mt-3">
              <a
                href={`${window.location.origin}/join?game=${gameId}`}
                target="_blank"
                className="bn-display text-2xl md:text-3xl text-[var(--gold-bright)] tracking-widest"
                rel="noreferrer"
              >
                {gameId}
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-4 justify-center mt-4">
            {players.length === 0 && (
              <div className="bn-chip">Waiting for players…</div>
            )}
            {players.length > 0 && (
              <div className="bn-chip bn-chip--live">
                {players.length} Player{players.length > 1 ? 's' : ''} joined
              </div>
            )}
          </div>
        </div>
      )}

      {isGameStarted &&
        matchups[currentMatchupIndex]?.left &&
        matchups[currentMatchupIndex]?.right && (
          <div style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 20 }}>
            <button type="button" className="coin-toss-trigger" onClick={startManualToss}>
              Demo Toss
            </button>
          </div>
        )}

      {activeToss && (
        <CoinToss
          contestants={activeToss.contestants}
          winner={activeToss.winner}
          autoStart={activeToss.autoStart}
          onComplete={clearToss}
        />
      )}

      <div className="w-full flex justify-center">
        {isGameStarted && !isGameOver && (
          <div className="mt-4">
            <ul className="list-none flex flex-wrap gap-3 justify-center">
              {players.map((player) => {
                const hasVoted = currentVotes.some((vote) => vote.playerId === player.id)
                return (
                  <li
                    key={player.id}
                    className={`bn-chip ${hasVoted ? 'bn-chip--done' : ''}`}
                  >
                    <span>{player.name}</span>
                    <span className="text-xs uppercase tracking-wide opacity-80">
                      {hasVoted ? 'Voted' : 'Pending'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {isGameOver && <Confetti />}
    </div>
  )
}

export default Home
