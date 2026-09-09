import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { socket } from '../lib/socket'
import { NightError, NightState } from '../lib/types'

export function PlayerApp() {
  const [params] = useSearchParams()
  const [roomId, setRoomId] = useState(params.get('game') || '')
  const [name, setName] = useState(localStorage.getItem('playerName') || '')
  const [playerId, setPlayerId] = useState('')
  const [state, setState] = useState<NightState | null>(null)
  const [error, setError] = useState('')
  const joined = Boolean(playerId)

  useEffect(() => {
    const fromQuery = params.get('game')
    if (fromQuery) setRoomId(fromQuery)
  }, [params])

  useEffect(() => {
    socket.on('night_state', (next: NightState) => setState(next))
    socket.on('night_error', (err: NightError) => setError(err.message))
    socket.on('joined', ({ player }: { player: { id: string } }) => {
      setPlayerId(player.id)
      setError('')
    })
    return () => {
      socket.off('night_state')
      socket.off('night_error')
      socket.off('joined')
    }
  }, [])

  const join = (event?: FormEvent) => {
    event?.preventDefault()
    setError('')
    localStorage.setItem('playerName', name)
    socket.emit('join', { roomId: roomId.trim().toUpperCase(), name })
  }

  const vote = (choice: 0 | 1) => {
    socket.emit('vote', { roomId: state?.roomId || roomId, playerId, choice })
  }

  const current = state?.matchups[state.currentMatchupIndex]
  const hasVoted = state?.votes.some(v => v.playerId === playerId)
  const live = state?.phase === 'matchup' && current?.left && current?.right
  const notice = useMemo(() => {
    if (state?.phase === 'coin') return `Tie. Coin toss on the TV. ${state.lastResult?.winner.name || 'Someone'} is coming through.`
    if (state?.phase === 'tally') return `${state.lastResult?.winner.name || 'Someone'} advances.`
    if (state?.phase === 'champion') return `${state.champion?.name || 'A champion'} takes the night.`
    return ''
  }, [state])

  return (
    <div className="page">
      <img className="logo" src="/bracket-night-gold.svg" alt="Bracket Night" />
      {!joined && (
        <form className="card" onSubmit={join}>
          <h1 className="display">Join the night</h1>
          <p>Enter the TV code and the name the room will shout.</p>
          <input className="bn-input" value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="Room code" />
          <input className="bn-input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          <button type="submit" className="bn-btn bn-btn--solid">Join</button>
          {error && <p className="banner banner--err">{error}</p>}
        </form>
      )}

      {joined && state?.phase === 'lobby' && (
        <div className="card">
          <h1 className="display">In the lobby</h1>
          <p>Wait for the host to load a field and start. Stay on this screen.</p>
          <div className="tv-players" style={{ marginTop: '0.8rem' }}>
            {(state.players || []).map(p => (
              <span key={p.id} className="chip">{p.name}</span>
            ))}
          </div>
        </div>
      )}

      {joined && live && current?.left && current?.right && (
        <div className="card">
          <h1 className="display">{state?.field?.title || 'Vote'}</h1>
          <p>{hasVoted ? 'Locked in. Watch the TV.' : 'Pick a side.'}</p>
          <div className="vote-grid">
            <button type="button" className="vote-card" disabled={hasVoted} onClick={() => vote(0)}>
              <img src={current.left.imageUrl || '/bn-logo-gold.svg'} alt={current.left.name} />
              <h3>{current.left.name}</h3>
            </button>
            <button type="button" className="vote-card" disabled={hasVoted} onClick={() => vote(1)}>
              <img src={current.right.imageUrl || '/bn-logo-gold.svg'} alt={current.right.name} />
              <h3>{current.right.name}</h3>
            </button>
          </div>
        </div>
      )}

      {joined && notice && (
        <div className="card">
          <h2 className="display">{state?.phase === 'champion' ? 'Champion' : 'Hold'}</h2>
          <p>{notice}</p>
          {state?.champion?.imageUrl && (
            <img src={state.champion.imageUrl} alt={state.champion.name} style={{ width: '100%', borderRadius: 12 }} />
          )}
        </div>
      )}

      {error && joined && <p className="banner banner--err">{error}</p>}

      <p className="footer">
        Built by Helvio. Thanks to Jackie for the snacks.
        {' '}
        <a href="https://buymeacoffee.com/helvio" target="_blank" rel="noreferrer">Donate</a>
        {' · '}
        <a href="/new">Create a field</a>
      </p>
    </div>
  )
}
