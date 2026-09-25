/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { socket } from '../lib/socket'
import { loadPlayerSession, newToken, savePlayerSession } from '../lib/session'
import { resumeCopy, roundLabel } from '../lib/round'
import {
  Bracket,
  GamePhase,
  Matchup,
  Player,
  PlayerSelf,
  PublicBracket,
  PublicGameState,
  Vote,
} from '../../backend/src/types'
import VotingCard from '../components/VotingCard'
import { CoinTossMobileNotice } from '../components/CoinToss'

const Join = () => {
  const router = useRouter()
  const gameQuery = typeof router.query.game === 'string' ? router.query.game : ''

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [bracket, setBracket] = useState<Bracket | null>(null)
  const [isGameMaster, setIsGameMaster] = useState(false)
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [currentMatchupIndex, setCurrentMatchupIndex] = useState(0)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentVotes, setCurrentVotes] = useState<Vote[]>([])
  const [hasJoined, setHasJoined] = useState(false)
  const [gameId, setGameId] = useState('')
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [phase, setPhase] = useState<GamePhase>('lobby')
  const [publicBrackets, setPublicBrackets] = useState<PublicBracket[]>([])
  const [hasVoted, setHasVoted] = useState(false)
  const [yourChoice, setYourChoice] = useState<number | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [link, setLink] = useState<'live' | 'dropped'>('live')
  const [resuming, setResuming] = useState(false)
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')
  const [moved, setMoved] = useState(false)

  const tokenRef = useRef('')
  const nameRef = useRef('')
  const playerIdRef = useRef('')
  const yieldSeatRef = useRef(false)
  const pendingResumeRef = useRef(false)
  const hasVotedRef = useRef(false)

  useEffect(() => {
    nameRef.current = name
  }, [name])

  useEffect(() => {
    hasVotedRef.current = hasVoted
  }, [hasVoted])

  useEffect(() => {
    if (!gameQuery) return
    setGameId(gameQuery)
    const saved = loadPlayerSession(gameQuery)
    if (saved) {
      tokenRef.current = saved.token
      nameRef.current = saved.name
      setName(saved.name)
      setHasJoined(true)
      setResuming(true)
    } else {
      const storedName = localStorage.getItem('playerName')
      if (storedName) setName(storedName)
      const storedCode = localStorage.getItem('code')
      if (storedCode) setCode(storedCode)
    }
  }, [gameQuery])

  useEffect(() => {
    if (!gameQuery) return

    const hello = () => {
      if (yieldSeatRef.current) return
      const saved = loadPlayerSession(gameQuery)
      const token = tokenRef.current || saved?.token || ''
      const playerName = nameRef.current || saved?.name || ''
      if (!token || !playerName) return
      tokenRef.current = token
      setLink('live')
      socket.emit('join', { gameId: gameQuery, playerName, playerToken: token })
    }

    const onJoined = (self: PlayerSelf) => {
      tokenRef.current = self.playerToken
      nameRef.current = self.name
      playerIdRef.current = self.playerId
      yieldSeatRef.current = false
      savePlayerSession(gameQuery, { token: self.playerToken, name: self.name })
      setName(self.name)
      setPlayerId(self.playerId)
      setIsGameMaster(self.isGameMaster)
      setHasVoted(self.hasVoted)
      hasVotedRef.current = self.hasVoted
      setYourChoice(self.choice)
      setHasJoined(true)
      setResuming(false)
      setMoved(false)
      setFormError('')
      setLink('live')
      if (self.resumed) pendingResumeRef.current = true
    }

    const onState = (state: PublicGameState) => {
      setGameId(state.gameId)
      setBracket(state.bracket)
      setMatchups(state.matchups)
      setCurrentMatchupIndex(state.currentMatchupIndex)
      setPlayers(state.players)
      setCurrentVotes(state.currentVotes)
      setIsGameStarted(state.isGameStarted)
      setPhase(state.phase)
      if (playerIdRef.current) {
        setIsGameMaster(state.gameMasterId === playerIdRef.current)
      }
      if (pendingResumeRef.current) {
        pendingResumeRef.current = false
        setNote(resumeCopy(state.phase, hasVotedRef.current))
      }
    }

    const onVoteStatus = ({ hasVoted: voted, choice }: { hasVoted: boolean, choice: number | null }) => {
      setHasVoted(voted)
      hasVotedRef.current = voted
      setYourChoice(choice)
    }

    const onError = (msg: string) => {
      setFormError(msg)
      setResuming(false)
      if (!playerIdRef.current) setHasJoined(false)
      if (msg === 'Voting is closed' || msg === 'Join the room first' || msg === 'Invalid choice') {
        setHasVoted(false)
        hasVotedRef.current = false
        setYourChoice(null)
      }
    }

    const onDrop = () => setLink('dropped')
    const onMaster = () => setIsGameMaster(true)
    const onMoved = () => {
      yieldSeatRef.current = true
      setMoved(true)
      setNote('This seat is open on another tab.')
    }

    socket.on('connect', hello)
    socket.on('disconnect', onDrop)
    socket.on('joined', onJoined)
    socket.on('game_master', onMaster)
    socket.on('game_state', onState)
    socket.on('vote_status', onVoteStatus)
    socket.on('error', onError)
    socket.on('session_moved', onMoved)

    if (socket.connected) hello()

    return () => {
      socket.off('connect', hello)
      socket.off('disconnect', onDrop)
      socket.off('joined', onJoined)
      socket.off('game_master', onMaster)
      socket.off('game_state', onState)
      socket.off('vote_status', onVoteStatus)
      socket.off('error', onError)
      socket.off('session_moved', onMoved)
    }
  }, [gameQuery])

  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    navigator.wakeLock?.request('screen').then((sentinel) => {
      if (cancelled) {
        sentinel.release().catch(() => undefined)
        return
      }
      lock = sentinel
    }).catch(() => undefined)
    return () => {
      cancelled = true
      lock?.release().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/public')
      .then((response) => response.json())
      .then((data: PublicBracket[]) => {
        if (!cancelled && Array.isArray(data)) setPublicBrackets(data)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const handleJoin = () => {
    const trimmed = name.trim()
    if (!gameId || !trimmed) return
    const token = tokenRef.current || newToken()
    tokenRef.current = token
    nameRef.current = trimmed
    yieldSeatRef.current = false
    savePlayerSession(gameId, { token, name: trimmed })
    setHasJoined(true)
    setResuming(true)
    setFormError('')
    socket.emit('join', { gameId, playerName: trimmed, playerToken: token })
    if (router.query.game !== gameId) {
      router.replace({ pathname: '/join', query: { game: gameId } }, undefined, { shallow: true })
    }
  }

  const handleSetBracket = (nextCode?: string) => {
    const value = (nextCode ?? code).trim().toLowerCase()
    if (!gameId || !value) return
    setCode(value)
    localStorage.setItem('code', value)
    socket.emit('set_bracket', { gameId, code: value })
  }

  const handleStart = () => {
    socket.emit('start_game', { gameId })
  }

  const handleVote = (choice: number) => {
    if (hasVoted || phase !== 'voting') return
    setHasVoted(true)
    hasVotedRef.current = true
    setYourChoice(choice)
    socket.emit('vote', { gameId, choice })
  }

  const reclaimSeat = () => {
    yieldSeatRef.current = false
    setMoved(false)
    const token = tokenRef.current
    const playerName = nameRef.current
    if (!gameQuery || !token || !playerName) return
    socket.emit('join', { gameId: gameQuery, playerName, playerToken: token })
  }

  const currentMatchup = matchups[currentMatchupIndex]
  const champion = matchups[14]?.winner ?? matchups[currentMatchupIndex - 1]?.winner
  const inLobby = hasJoined && !isGameStarted && phase === 'lobby'

  return (
    <div className="bn-page bn-page--stadium min-h-screen flex flex-col items-center p-4 gap-4">
      {link === 'dropped' && hasJoined && !moved && (
        <div className="link-banner" role="status">
          Signal dropped. Your seat is saved — hang on.
        </div>
      )}

      {(!isGameStarted || phase === 'champion') && (
        <img
          src="/bracket-night-gold.svg"
          alt="Bracket Night"
          className="player-logo"
        />
      )}

      {note && hasJoined && (
        <div className="resume-banner" role="status">{note}</div>
      )}

      {formError && <div className="resume-banner is-error" role="alert">{formError}</div>}

      {moved && (
        <div className="bn-card player-shell p-6">
          <h1 className="player-state-title">Seat moved</h1>
          <p className="player-state-copy mb-4">
            Another tab took this phone&apos;s seat. You can pull it back.
          </p>
          <button type="button" onClick={reclaimSeat} className="bn-btn bn-btn--gold">
            Take my seat back
          </button>
        </div>
      )}

      {!hasJoined && !moved && (
        <div className="flex-grow flex items-center justify-center w-full">
          <div className="bn-card player-shell p-6">
            <h1 className="player-state-title">Join the night</h1>
            <p className="player-state-copy mb-4">
              The room code is on the TV. Your name is your seat for the whole night.
            </p>

            <input
              type="text"
              value={gameId}
              onChange={(e) => setGameId(e.target.value.trim())}
              placeholder="Game ID"
              className="bn-input"
              autoCapitalize="characters"
            />

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="bn-input"
              maxLength={20}
              onKeyUp={(e) => {
                if (e.key === 'Enter') handleJoin()
              }}
            />

            <button type="button" onClick={handleJoin} className="bn-btn bn-btn--gold">
              Join Game
            </button>
          </div>
        </div>
      )}

      {resuming && hasJoined && !playerId && !moved && (
        <div className="bn-card player-shell p-6">
          <h1 className="player-state-title">Pulling you back in</h1>
          <p className="player-state-copy">Same phone, same seat. The night did not reset.</p>
        </div>
      )}

      {inLobby && playerId && !moved && (
        <div className={`bn-card player-shell player-lobby p-6 ${bracket ? 'is-bracket-set' : ''}`}>
          <div className="player-lobby-header">
            <p className="player-lobby-kicker">
              {isGameMaster ? 'Game master' : 'Your seat'}
            </p>
            <p className="player-lobby-seat">{name}</p>
            <p className="player-lobby-meter" aria-live="polite">
              {players.length} {players.length === 1 ? 'phone' : 'phones'} in the room
            </p>
          </div>

          {isGameMaster && !bracket && (
            <div>
              <h1 className="player-state-title">Set the bracket</h1>
              <p className="player-state-copy mb-4">
                You&apos;re the game master. Load the demo night or drop in a bracket code.
              </p>

              <button
                type="button"
                onClick={() => handleSetBracket('demo')}
                className="bn-btn bn-btn--gold"
              >
                Load Mountain GOATs
              </button>

              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Or enter a bracket code"
                className="bn-input mt-4"
                onKeyUp={(e) => {
                  if (e.key === 'Enter') handleSetBracket()
                }}
              />

              <button type="button" onClick={() => handleSetBracket()} className="bn-btn bn-btn--ghost">
                Load code
              </button>
            </div>
          )}

          {isGameMaster && bracket && (
            <>
              <div className="player-ready-banner" role="status">
                <span className="player-ready-pulse" aria-hidden />
                Bracket locked · phones are in
              </div>
              <button type="button" onClick={handleStart} className="bn-btn bn-btn--gold mt-2">
                Everyone ready — start
              </button>
              <p className="player-demo-tip" role="note">
                {players.length < 2
                  ? 'Wait for a second phone — two players can force a coin by voting opposite sides.'
                  : players.length % 2 === 1
                    ? `Odd count (${players.length}): a natural tie needs an even number of voters. Add or drop a phone for the coin demo.`
                    : `${players.length} players (even): pick opposite sides on the first matchup to force the TV coin toss.`}
              </p>
            </>
          )}

          {!bracket && !isGameMaster && (
            <div className="player-waiting">
              <span className="player-waiting-pulse" aria-hidden />
              <p className="player-state-copy">Waiting for the bracket to be set…</p>
            </div>
          )}
          {bracket && !isGameMaster && (
            <div className="player-waiting">
              <span className="player-waiting-pulse" aria-hidden />
              <h1 className="player-state-title">{bracket.title}</h1>
              <p className="player-state-copy">Waiting for the game master to begin…</p>
            </div>
          )}

          <h2 className="bn-display text-xl mt-5 mb-1 text-[var(--gold)] tracking-widest text-center">
            Players in room
          </h2>
          <div className="player-list">
            {players.map((player) => (
              <div
                key={player.id}
                className={`player-pill ${player.id === playerId ? 'is-you' : ''} ${player.connected ? '' : 'is-away'}`}
              >
                <span className={`presence ${player.connected ? '' : 'is-away'}`} />
                {player.name}
                {player.id === playerId ? ' · you' : ''}
                {!player.connected ? ' · reconnecting' : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasJoined && isGameStarted && !moved && (
        <div className="player-shell w-full">
          {bracket && phase !== 'champion' && (
            <div className="text-center mb-3">
              <p className="bn-display vote-eyebrow">{roundLabel(currentMatchupIndex)}</p>
              <h2 className="bn-display text-4xl text-[var(--gold-bright)]">{bracket.title}</h2>
              <h3 className="text-[var(--text-muted)] mt-1">{bracket.subtitle}</h3>
            </div>
          )}

          {phase === 'coin' && (
            <CoinTossMobileNotice
              leftName={currentMatchup?.left?.name}
              rightName={currentMatchup?.right?.name}
            />
          )}

          {phase === 'voting' && currentMatchup && (
            <VotingCard
              matchup={currentMatchup}
              hasVoted={hasVoted}
              yourChoice={yourChoice}
              round={roundLabel(currentMatchupIndex)}
              lockedCount={currentVotes.length}
              playerCount={players.length}
              onVote={handleVote}
            />
          )}

          {phase === 'champion' && (
            <div className="bn-card p-6 game-over-winner">
              <p className="player-champ-kicker">Champion of the night</p>
              {bracket?.title && <p className="player-champ-bracket">{bracket.title}</p>}
              {champion?.image_url && (
                <img src={champion.image_url} alt={champion.name || 'Winner'} />
              )}
              <h2 className="player-champ-name">{champion?.name || 'Bracket complete'}</h2>
              <p className="player-champ-seal">The night is sealed</p>
            </div>
          )}
        </div>
      )}

      {isGameMaster && !bracket && hasJoined && !moved && (
        <>
          <h2 className="bn-display text-2xl text-[var(--gold)] tracking-widest mt-2">
            Public brackets
          </h2>
          {publicBrackets.length === 0 && (
            <p className="player-state-copy">No saved public brackets yet. DEMO is ready.</p>
          )}
          {publicBrackets.map((publicBracket) => (
            <div key={publicBracket.code} className="bn-card public-bracket-row">
              <div>
                <h3 className="text-lg font-bold mb-1">{publicBracket.title}</h3>
                <p className="text-sm text-[var(--text-muted)]">{publicBracket.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCode(publicBracket.code)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="bn-btn bn-btn--ghost"
                style={{ width: 'auto', paddingInline: '1rem' }}
              >
                Fill
              </button>
            </div>
          ))}
        </>
      )}

      <footer className="player-footer">
        <p>
          Bracket Night was lovingly crafted by Helvio for the world.
          <br />
          Thanks to Jackie for the support and snacks during development.
          <br />
          If you&apos;d like to show some love, consider{' '}
          <a
            href="https://buymeacoffee.com/helvio"
            target="_blank"
            rel="noopener noreferrer"
          >
            donating
          </a>
          .
        </p>
      </footer>
    </div>
  )
}

export default Join
