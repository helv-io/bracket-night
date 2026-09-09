import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { socket } from '../lib/socket'
import { APP_VERSION_LABEL } from '../lib/version'
import { NightError, NightState } from '../lib/types'
import { COIN_ACK_MS } from '../../../engine/src/coinToss'
import { ArenaRig, TvView } from './NightScene'

export function HostNight() {
  const [state, setState] = useState<NightState | null>(null)
  const [error, setError] = useState('')
  const [code, setCode] = useState('showcase')
  const [tvView, setTvView] = useState<TvView>('arena')
  const roomId = state?.roomId || ''
  const ackFor = useRef<string>('')
  const beat = useRef(0)

  useEffect(() => {
    socket.emit('create_room')
    socket.on('room_created', ({ roomId }: { roomId: string }) => {
      setState(prev => prev && prev.roomId === roomId ? prev : {
        roomId,
        phase: 'lobby',
        field: null,
        matchups: [],
        currentMatchupIndex: 0,
        players: [],
        votes: [],
        started: false,
        champion: null,
        lastResult: null,
        maxPlayers: 16,
        waitingOn: [],
      })
    })
    socket.on('night_state', (next: NightState) => {
      const id = ++beat.current
      setState(prev => {
        const hold = prev
          && prev.phase === 'matchup'
          && (next.phase === 'tally' || next.phase === 'coin' || next.phase === 'champion')
        if (hold) {
          window.setTimeout(() => {
            if (beat.current === id) setState(next)
          }, 1600)
          return { ...prev, votes: next.votes, lastResult: next.lastResult }
        }
        return next
      })
    })
    socket.on('night_error', (err: NightError) => setError(err.message))
    return () => {
      socket.off('room_created')
      socket.off('night_state')
      socket.off('night_error')
    }
  }, [])

  useEffect(() => {
    if (!state) return
    if (state.phase !== 'coin' && state.phase !== 'tally') {
      ackFor.current = ''
      return
    }
    const key = `${state.phase}:${state.lastResult?.matchupId}:${state.currentMatchupIndex}`
    if (ackFor.current === key) return
    ackFor.current = key
    const delay = state.phase === 'coin' ? COIN_ACK_MS : 1600
    const timer = window.setTimeout(() => {
      socket.emit('ack_cinematic', { roomId: state.roomId })
    }, delay)
    return () => window.clearTimeout(timer)
  }, [state])

  const joinUrl = useMemo(() => {
    if (!roomId || typeof window === 'undefined') return ''
    return `${window.location.origin}/join?game=${roomId}`
  }, [roomId])

  const loadField = () => {
    setError('')
    socket.emit('set_field', { roomId, code })
  }

  const start = () => {
    setError('')
    socket.emit('start_night', { roomId })
  }

  const resolveNow = () => {
    setError('')
    socket.emit('resolve_now', { roomId })
  }

  useEffect(() => {
    if (state?.phase === 'coin') setTvView('arena')
  }, [state?.phase])

  const openedTree = useRef(false)
  useEffect(() => {
    if (!state?.started || !state.matchups.length || openedTree.current) return
    openedTree.current = true
    setTvView('bracket')
    const timer = window.setTimeout(() => setTvView('arena'), 2800)
    return () => window.clearTimeout(timer)
  }, [state?.started, state?.matchups.length])

  useEffect(() => {
    if (state?.phase !== 'champion') return
    const timer = window.setTimeout(() => setTvView('bracket'), 2000)
    return () => window.clearTimeout(timer)
  }, [state?.phase])

  const canShowBracket = Boolean(state?.started && state.matchups.length > 0)

  return (
    <div className="tv-root">
      <audio src="/background.ogg" autoPlay loop />
      <Canvas camera={{ position: [0, 5.4, 12], fov: 42 }} shadows>
        <ArenaRig state={state} joinUrl={joinUrl} tvView={tvView} />
      </Canvas>
      <div className="tv-hud">
        <header className="tv-top">
          <div className="tv-brand">
            <img src="/bracket-night-gold.svg" alt="Bracket Night" />
            <p className="tv-kicker">{state?.field?.title || 'A new night'}</p>
            <p className="tv-copy">{state?.field?.subtitle || 'TV host. Phones join. One champion.'}</p>
          </div>
          {state?.phase === 'lobby' && (
            <div className="tv-panel">
              <p className="tv-copy">Join code</p>
              <p className="tv-code">{roomId || '…'}</p>
              <input
                className="bn-input"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="showcase or template code"
              />
              <div className="tv-actions">
                <button type="button" className="bn-btn" onClick={loadField} disabled={!roomId}>
                  Load field
                </button>
                <button
                  type="button"
                  className="bn-btn bn-btn--solid"
                  onClick={start}
                  disabled={!state?.field}
                >
                  Start night
                </button>
              </div>
              {error && <p className="tv-error">{error}</p>}
            </div>
          )}
        </header>
        <footer className="tv-bottom">
          <div className="tv-players">
            {(state?.players || []).map(player => {
              const voted = state?.votes.some(v => v.playerId === player.id)
              const cls = [
                'chip',
                voted ? 'chip--done' : '',
                player.connected ? '' : 'chip--out',
              ].join(' ')
              return (
                <span key={player.id} className={cls}>
                  {player.name}
                  {voted ? ' · in' : player.connected ? '' : ' · out'}
                </span>
              )
            })}
          </div>
          <div className="tv-actions">
            {canShowBracket && (
              <button
                type="button"
                className={`bn-btn ${tvView === 'bracket' ? 'bn-btn--solid' : ''}`}
                onClick={() => setTvView(v => (v === 'bracket' ? 'arena' : 'bracket'))}
              >
                {tvView === 'bracket' ? 'Back to fight' : 'Full bracket'}
              </button>
            )}
            {state?.started && state.phase === 'matchup' && state.waitingOn.length > 0 && (
              <button type="button" className="bn-btn" onClick={resolveNow}>
                Resolve now
              </button>
            )}
          </div>
        </footer>
        <div className="tv-version">{APP_VERSION_LABEL}</div>
      </div>
    </div>
  )
}
