/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { isMobile } from 'react-device-detect'
import { QRCodeSVG } from 'qrcode.react'
import Confetti from 'react-confetti'
import { socket } from '../lib/socket'
import { clearHostSession, loadHostSession, saveHostSession } from '../lib/session'
import { roundLabel } from '../lib/round'
import { APP_VERSION_LABEL } from '../lib/version'
import Bracket from '../components/Bracket'
import {
  CoinTossState,
  GamePhase,
  Matchup,
  Player,
  Bracket as BracketType,
  PublicGameState,
  Vote,
} from '../../backend/src/types'
import CoinToss from '@/components/CoinToss'

type ActiveToss = {
  contestants: [CoinTossState['left'], CoinTossState['right']]
  winner: 0 | 1
  autoStart: boolean
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
  const hostTokenRef = useRef<string | null>(null)
  const phaseRef = useRef<GamePhase>('lobby')
  const matchupsRef = useRef(matchups)
  const currentMatchupIndexRef = useRef(currentMatchupIndex)
  const tossActiveRef = useRef(false)
  const coinKeyRef = useRef<string | null>(null)

  useEffect(() => {
    gameIdRef.current = gameId
  }, [gameId])

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

  const showCoin = useCallback((coin: CoinTossState) => {
    const key = `${coin.matchupIndex}:${coin.winner.id}:${coin.startedAt}`
    if (coinKeyRef.current === key && tossActiveRef.current) return
    coinKeyRef.current = key
    tossActiveRef.current = true
    setActiveToss({
      contestants: [coin.left, coin.right],
      winner: coin.winnerSide,
      autoStart: true,
    })
  }, [])

  const applyState = useCallback((state: PublicGameState) => {
    setGameId(state.gameId)
    gameIdRef.current = state.gameId
    setBracket(state.bracket)
    setPlayers(state.players)
    setCurrentVotes(state.currentVotes)
    setIsGameStarted(state.isGameStarted)
    phaseRef.current = state.phase
    setMatchups(state.matchups)
    matchupsRef.current = state.matchups
    setCurrentMatchupIndex(state.currentMatchupIndex)
    currentMatchupIndexRef.current = state.currentMatchupIndex

    if (state.phase === 'coin' && state.coin) {
      setIsGameOver(false)
      showCoin(state.coin)
      return
    }

    tossActiveRef.current = false
    coinKeyRef.current = null
    setActiveToss(null)
    setIsGameOver(state.isGameOver || state.phase === 'champion')
  }, [showCoin])

  const clearToss = useCallback(() => {
    const id = gameIdRef.current
    const token = hostTokenRef.current
    if (id && token) socket.emit('coin_complete', { gameId: id, hostToken: token })
    if (phaseRef.current !== 'coin') {
      tossActiveRef.current = false
      coinKeyRef.current = null
      setActiveToss(null)
    }
  }, [])

  useEffect(() => {
    if (isMobile) {
      router.push('/new')
      return
    }

    const remember = (msg: { gameId: string, hostToken: string }) => {
      if (!msg?.gameId || !msg.hostToken) return
      hostTokenRef.current = msg.hostToken
      saveHostSession({ gameId: msg.gameId, hostToken: msg.hostToken })
      setGameId(msg.gameId)
      gameIdRef.current = msg.gameId
    }

    const hello = () => {
      const saved = loadHostSession()
      if (saved) {
        hostTokenRef.current = saved.hostToken
        socket.emit('host_attach', saved)
        return
      }
      socket.emit('create_game')
    }

    const onAttachFailed = () => {
      clearHostSession()
      hostTokenRef.current = null
      socket.emit('create_game')
    }

    const onAdvanced = ({
      currentMatchupIndex: nextIndex,
    }: {
      currentMatchupIndex: number
    }) => {
      phaseRef.current = nextIndex >= 15 ? 'champion' : 'voting'
      tossActiveRef.current = false
      coinKeyRef.current = null
      setActiveToss(null)
    }

    socket.on('game_created', remember)
    socket.on('host_attached', remember)
    socket.on('host_attach_failed', onAttachFailed)
    socket.on('game_state', applyState)
    socket.on('coin_toss', showCoin)
    socket.on('matchup_advanced', onAdvanced)
    socket.on('connect', hello)

    if (socket.connected) hello()

    return () => {
      socket.off('game_created', remember)
      socket.off('host_attached', remember)
      socket.off('host_attach_failed', onAttachFailed)
      socket.off('game_state', applyState)
      socket.off('coin_toss', showCoin)
      socket.off('matchup_advanced', onAdvanced)
      socket.off('connect', hello)
    }
  }, [applyState, router, showCoin])

  useEffect(() => {
    window.__bnTriggerCoinToss = (winner = 0) => {
      const current = matchupsRef.current[currentMatchupIndexRef.current]
      if (!current?.left || !current?.right) return
      tossActiveRef.current = true
      coinKeyRef.current = null
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

  const liveMatchup =
    isGameStarted && !isGameOver && !activeToss ? matchups[currentMatchupIndex] : null
  const champion = matchups[14]?.winner ?? matchups[currentMatchupIndex - 1]?.winner ?? null
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

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
            <p className="host-kicker">A live tournament for the room</p>
            <h1 className="bn-display text-4xl md:text-6xl text-[var(--gold-bright)]">
              Welcome to Bracket Night
            </h1>
          </div>
        )}
      </main>

      {liveMatchup?.left && liveMatchup.right && (
        <div className="host-now" aria-live="polite">
          <div className="host-now-side">
            <img src={liveMatchup.left.image_url} alt="" />
            <span className="host-now-name">{liveMatchup.left.name}</span>
          </div>
          <div className="host-now-meta">
            <span>{roundLabel(currentMatchupIndex)}</span>
            <strong>
              {currentVotes.length}/{players.length} locked
            </strong>
          </div>
          <div className="host-now-side is-right">
            <img src={liveMatchup.right.image_url} alt="" />
            <span className="host-now-name">{liveMatchup.right.name}</span>
          </div>
        </div>
      )}

      {!isGameStarted && gameId && (
        <div className="text-center qr-container">
          <div className="bn-card p-4 inline-block">
            <p className="text-sm text-[var(--text-muted)] mb-1 tracking-wide uppercase">
              Scan to join
            </p>
            <p className="text-xs text-[var(--text-muted)] mb-2">
              Game master loads <span className="host-code-pill">DEMO</span>
            </p>
            <div className="host-qr-pad w-24 md:w-32 lg:w-48 mx-auto bg-white p-2">
              <QRCodeSVG
                value={`${origin}/join?game=${gameId}`}
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
                href={`${origin}/join?game=${gameId}`}
                target="_blank"
                className="bn-display text-2xl md:text-3xl text-[var(--gold-bright)] tracking-widest"
                rel="noreferrer"
              >
                {gameId}
              </a>
            </div>
            <div className="host-roster">
              {players.length === 0 && <div className="bn-chip">Waiting for players…</div>}
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`bn-chip ${player.connected ? 'bn-chip--live' : 'bn-chip--away'}`}
                >
                  <span className={`presence ${player.connected ? '' : 'is-away'}`} />
                  <span>{player.name}</span>
                  {!player.connected && <span className="text-xs uppercase tracking-wide">Reconnecting</span>}
                </div>
              ))}
            </div>
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
                  className={`bn-chip ${hasVoted ? 'bn-chip--done' : ''} ${player.connected ? '' : 'bn-chip--away'}`}
                >
                  <span className={`presence ${player.connected ? '' : 'is-away'}`} />
                  <span>{player.name}</span>
                  <span className="text-xs uppercase tracking-wide opacity-80">
                    {player.connected ? (hasVoted ? 'Voted' : 'Pending') : 'Reconnecting'}
                  </span>
                </li>
              )
            })}
          </ul>
        </footer>
      )}

      {isGameOver && !activeToss && (
        <div className="champion-curtain">
          <Confetti />
          <p className="champion-kicker">Champion of the night</p>
          {champion?.image_url && (
            <img src={champion.image_url} alt={champion.name} />
          )}
          <h2 className="champion-name">{champion?.name || 'The bracket is complete'}</h2>
        </div>
      )}

      <div className="host-version" aria-hidden="true">
        {APP_VERSION_LABEL}
      </div>
    </div>
  )
}

export default Home
