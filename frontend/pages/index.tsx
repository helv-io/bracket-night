/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { isMobile } from 'react-device-detect'
import { QRCodeSVG } from 'qrcode.react'
import Confetti from 'react-confetti'
import { socket } from '../lib/socket'
import { APP_VERSION_LABEL } from '../lib/version'
import Bracket from '../components/Bracket'
import { Matchup, Player, Bracket as BracketType, Vote, Contestant } from '../../backend/src/types'
import CoinToss from '@/components/CoinToss'

type ActiveToss = {
  contestants: [Contestant, Contestant]
  winner: 0 | 1
  autoStart: boolean
}

/** Server advance held until the coin cinematic fully completes */
type PendingAdvance = {
  matchups: Matchup[]
  currentMatchupIndex: number
}

declare global {
  interface Window {
    /** Recording / automation only — not exposed in the host UI */
    __bnTriggerCoinToss?: (winner?: 0 | 1) => void
  }
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
  const matchupsRef = useRef(matchups)
  const currentMatchupIndexRef = useRef(currentMatchupIndex)
  const pendingAdvanceRef = useRef<PendingAdvance | null>(null)
  const tossActiveRef = useRef(false)

  useEffect(() => {
    gameIdRef.current = gameId
  }, [gameId])

  useEffect(() => {
    currentVotesRef.current = currentVotes
  }, [currentVotes])

  useEffect(() => {
    matchupsRef.current = matchups
  }, [matchups])

  useEffect(() => {
    currentMatchupIndexRef.current = currentMatchupIndex
  }, [currentMatchupIndex])

  useEffect(() => {
    document.documentElement.classList.add('bn-host-tv')
    return () => document.documentElement.classList.remove('bn-host-tv')
  }, [])

  const applyAdvance = useCallback((next: PendingAdvance) => {
    setMatchups(next.matchups)
    matchupsRef.current = next.matchups
    setCurrentMatchupIndex(next.currentMatchupIndex)
    currentMatchupIndexRef.current = next.currentMatchupIndex
    if (next.currentMatchupIndex === 15) setIsGameOver(true)
  }, [])

  useEffect(() => {
    if (isMobile) {
      router.push('/new')
      return
    }

    socket.emit('create_game')

    socket.on('matchup_advanced', ({ matchups, currentMatchupIndex, wasTie }) => {
      const prevIndex = currentMatchupIndex - 1

      // Prefer server wasTie — client vote refs race with the preceding game_state.
      if (wasTie && prevIndex >= 0) {
        const completed = matchups[prevIndex] as Matchup
        if (completed?.left && completed?.right && completed.winner) {
          const winnerSide: 0 | 1 =
            completed.winner.id === completed.left.id ? 0 : 1

          // Cliffhanger: keep the pre-advance bracket on screen (no winner yet).
          // Apply matchups only when CoinToss calls onComplete.
          pendingAdvanceRef.current = { matchups, currentMatchupIndex }
          tossActiveRef.current = true
          setActiveToss({
            contestants: [completed.left, completed.right],
            winner: winnerSide,
            autoStart: true,
          })
          setCurrentVotes([])
          currentVotesRef.current = []
          return
        }
      }

      setMatchups(matchups)
      matchupsRef.current = matchups
      setCurrentMatchupIndex(currentMatchupIndex)
      currentMatchupIndexRef.current = currentMatchupIndex
      setCurrentVotes([])
      currentVotesRef.current = []

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
        setPlayers(players)
        setCurrentVotes(currentVotes)
        currentVotesRef.current = currentVotes
        setIsGameStarted(isGameStarted)

        // Don't spoil the cliffhanger if a game_state arrives mid-toss
        if (tossActiveRef.current || pendingAdvanceRef.current) {
          return
        }

        setMatchups(matchups)
        matchupsRef.current = matchups
        setCurrentMatchupIndex(currentMatchupIndex)
        currentMatchupIndexRef.current = currentMatchupIndex
        setIsGameOver(isGameOver)
      }
    )

    return () => {
      socket.off('matchup_advanced')
      socket.off('game_state')
    }
  }, [router])

  const clearToss = useCallback(() => {
    const pending = pendingAdvanceRef.current
    pendingAdvanceRef.current = null
    tossActiveRef.current = false
    setActiveToss(null)
    // Reveal bracket winners only after the full cinematic (spin + celebrate hold)
    if (pending) applyAdvance(pending)
  }, [applyAdvance])

  // Automation hook for Demo recordings — no host UI control
  useEffect(() => {
    window.__bnTriggerCoinToss = (winner = 0) => {
      const current = matchupsRef.current[currentMatchupIndexRef.current]
      if (!current?.left || !current?.right) return
      tossActiveRef.current = true
      setActiveToss({
        contestants: [current.left, current.right],
        winner,
        autoStart: true,
      })
    }
    return () => {
      delete window.__bnTriggerCoinToss
    }
  }, [])

  return (
    <div className="bn-page bn-page--stadium bn-page--host">
      <audio src="/background.ogg" autoPlay loop />

      <header className="host-chrome host-chrome--top">
        <div className="logo-container logo-container--inline">
          <img
            src="/bracket-night-gold.svg"
            alt="Bracket Night"
            className="logo logo--host"
          />
          {bracket && (
            <>
              <h1 className="bn-display host-title">{bracket.title}</h1>
              <h2 className="host-subtitle">{bracket.subtitle}</h2>
            </>
          )}
        </div>
      </header>

      <main className="host-bracket-area">
        {matchups.length > 0 && (
          <Bracket matchups={matchups} currentMatchupIndex={currentMatchupIndex} />
        )}
        {matchups.length === 0 && (
          <div className="host-welcome">
            <h1 className="bn-display text-4xl md:text-5xl text-[var(--gold-bright)] mb-3 drop-shadow-lg">
              Welcome to Bracket Night
            </h1>
            <p className="text-lg md:text-xl text-[var(--text-muted)]">
              The arena is almost set. Scan in, pick your fighter energy, and let the room decide.
            </p>
          </div>
        )}
      </main>

      {!isGameStarted && gameId && (
        <div className="text-center qr-container">
          <div className="bn-card p-4 inline-block">
            <p className="text-sm text-[var(--text-muted)] mb-2 tracking-wide uppercase">
              Scan to join
            </p>
            <div className="host-qr-pad w-24 md:w-32 lg:w-48 mx-auto bg-white p-2">
              <QRCodeSVG
                value={`${window.location.origin}/join?game=${gameId}`}
                imageSettings={{
                  src: '/bn-logo-gold.svg',
                  height: 48,
                  width: 48,
                  excavate: true,
                }}
                size={256}
                className="host-qr-code w-full h-auto"
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

      {activeToss && (
        <CoinToss
          contestants={activeToss.contestants}
          winner={activeToss.winner}
          autoStart={activeToss.autoStart}
          onComplete={clearToss}
        />
      )}

      {isGameStarted && !isGameOver && !activeToss && (
        <footer className="host-chrome host-chrome--bottom">
          <ul className="list-none flex flex-wrap gap-2 justify-center">
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
        </footer>
      )}

      {isGameOver && <Confetti />}

      {/* Discreet build version — host TV only; stays visible over coin overlay corner */}
      <div className="host-version" aria-hidden="true">
        {APP_VERSION_LABEL}
      </div>
    </div>
  )
}

export default Home
