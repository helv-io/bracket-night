/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { isMobile } from 'react-device-detect'
import { socket } from '../lib/socket'
import { APP_VERSION_LABEL } from '../lib/version'
import { Matchup, Player, Bracket as BracketType, Vote } from '../../backend/src/types'
import { HostPhase, TallyView, TossView } from '../lib/nightView'
import { CoinTossMobileNotice } from '@/components/CoinToss'

const HostNight = dynamic(() => import('../components/host/HostNight'), { ssr: false })

const TALLY_MS = 2200
const TALLY_MS_REDUCED = 900

type PendingAdvance = {
  matchups: Matchup[]
  currentMatchupIndex: number
  wasTie: boolean
  bye: boolean
  tallies: { left: number; right: number }
}

declare global {
  interface Window {
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
  const [tally, setTally] = useState<TallyView | null>(null)
  const [toss, setToss] = useState<TossView | null>(null)
  const [localPhase, setLocalPhase] = useState<HostPhase | null>(null)
  const [joinUrl, setJoinUrl] = useState('')

  const gameIdRef = useRef(gameId)
  const matchupsRef = useRef(matchups)
  const currentMatchupIndexRef = useRef(currentMatchupIndex)
  const queueRef = useRef<PendingAdvance[]>([])
  const busyRef = useRef(false)
  const tallyTimerRef = useRef(0)

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

  useEffect(() => {
    if (typeof window === 'undefined' || !gameId) return
    setJoinUrl(`${window.location.origin}/join?game=${gameId}`)
  }, [gameId])

  const applyAdvance = useCallback((next: PendingAdvance) => {
    setMatchups(next.matchups)
    matchupsRef.current = next.matchups
    setCurrentMatchupIndex(next.currentMatchupIndex)
    currentMatchupIndexRef.current = next.currentMatchupIndex
    setCurrentVotes([])
    const over = next.currentMatchupIndex >= next.matchups.length
    setIsGameOver(over)
    setTally(null)
    setToss(null)
    setLocalPhase(over ? 'champion' : null)
  }, [])

  const pump = useCallback(() => {
    const next = queueRef.current.shift()
    if (!next) {
      busyRef.current = false
      return
    }
    busyRef.current = true

    if (next.bye) {
      applyAdvance(next)
      busyRef.current = false
      pump()
      return
    }

    const prev = matchupsRef.current[currentMatchupIndexRef.current]
    setTally({
      left: next.tallies.left,
      right: next.tallies.right,
      leftName: prev?.left?.name || 'Left',
      rightName: prev?.right?.name || 'Right',
    })
    setLocalPhase('tally')
    setCurrentVotes([])

    window.clearTimeout(tallyTimerRef.current)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    tallyTimerRef.current = window.setTimeout(() => {
      if (next.wasTie && prev?.left && prev?.right && next.matchups[next.currentMatchupIndex - 1]?.winner) {
        const completed = next.matchups[next.currentMatchupIndex - 1]
        const winnerSide: 0 | 1 = completed.winner?.id === completed.left?.id ? 0 : 1
        setToss({ contestants: [prev.left, prev.right], winner: winnerSide })
        setLocalPhase('coin')
        queueRef.current.unshift(next)
        return
      }
      applyAdvance(next)
      busyRef.current = false
      pump()
    }, reduced ? TALLY_MS_REDUCED : TALLY_MS)
  }, [applyAdvance])

  const enqueueAdvance = useCallback((advance: PendingAdvance) => {
    queueRef.current.push(advance)
    if (!busyRef.current) pump()
  }, [pump])

  const clearToss = useCallback(() => {
    const pending = queueRef.current.shift()
    setToss(null)
    if (pending) applyAdvance(pending)
    busyRef.current = false
    pump()
  }, [applyAdvance, pump])

  useEffect(() => {
    if (isMobile) {
      router.push('/new')
      return
    }

    socket.emit('create_game')

    socket.on('matchup_advanced', (payload: PendingAdvance) => {
      enqueueAdvance({
        matchups: payload.matchups,
        currentMatchupIndex: payload.currentMatchupIndex,
        wasTie: Boolean(payload.wasTie),
        bye: Boolean(payload.bye),
        tallies: payload.tallies || { left: 0, right: 0 },
      })
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
        setIsGameStarted(isGameStarted)

        if (busyRef.current || queueRef.current.length > 0) return

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
      window.clearTimeout(tallyTimerRef.current)
    }
  }, [router, enqueueAdvance])

  useEffect(() => {
    window.__bnTriggerCoinToss = (winner = 0) => {
      const current = matchupsRef.current[currentMatchupIndexRef.current]
      if (!current?.left || !current?.right) return
      setToss({ contestants: [current.left, current.right], winner })
      setLocalPhase('coin')
    }
    return () => {
      delete window.__bnTriggerCoinToss
    }
  }, [])

  const nightPhase: HostPhase = (() => {
    if (localPhase) return localPhase
    if (isGameOver) return 'champion'
    if (isGameStarted && matchups.length > 0) return 'matchup'
    return 'lobby'
  })()

  return (
    <div className="bn-page bn-page--stadium bn-page--host bn-page--host3d">
      <audio src="/background.ogg" autoPlay loop />

      <HostNight
        phase={nightPhase}
        gameId={gameId}
        joinUrl={joinUrl}
        bracket={bracket}
        matchups={matchups}
        currentMatchupIndex={currentMatchupIndex}
        players={players}
        currentVotes={currentVotes}
        tally={tally}
        toss={toss}
        onTossComplete={clearToss}
      />

      <div className="bn-host-hud">
        <img
          src="/bracket-night-gold.svg"
          alt="Bracket Night"
          className="bn-host-hud__logo"
        />
        {bracket && (
          <div className="bn-host-hud__meta">
            <h1>{bracket.title}</h1>
            <p>{bracket.subtitle}</p>
          </div>
        )}
        {nightPhase === 'lobby' && gameId && (
          <a className="bn-host-hud__join" href={joinUrl} target="_blank" rel="noreferrer">
            {gameId}
          </a>
        )}
        {nightPhase === 'coin' && (
          <div className="sr-only">
            <CoinTossMobileNotice />
          </div>
        )}
      </div>

      <div className="host-version" aria-hidden="true">
        {APP_VERSION_LABEL}
      </div>
    </div>
  )
}

export default Home
