/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { socket } from '../lib/socket'
import { Bracket, Matchup, Player, PublicBracket, Vote } from '../../backend/src/types'
import VotingCard from '../components/VotingCard'
import { CoinTossMobileNotice } from '../components/CoinToss'

const Join = () => {
  const router = useRouter()
  const { game } = router.query

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
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [publicBrackets, setPublicBrackets] = useState<PublicBracket[]>([])
  const [tieNotice, setTieNotice] = useState<{ winnerName: string } | null>(null)
  const currentVotesRef = useRef(currentVotes)

  useEffect(() => {
    currentVotesRef.current = currentVotes
  }, [currentVotes])

  useEffect(() => {
    const storedName = localStorage.getItem('playerName')
    if (storedName) setName(storedName)

    const storedCode = localStorage.getItem('code')
    if (storedCode) setCode(storedCode)

    if (game) setGameId(game as string)
  }, [game])

  useEffect(() => {
    if (!game) return

    socket.on('player_joined', ({ players }) => setPlayers(players))
    socket.on('game_master', () => setIsGameMaster(true))

    socket.on('bracket_set', ({ bracket, matchups, currentMatchupIndex }) => {
      setBracket(bracket as Bracket)
      setMatchups(matchups as Matchup[])
      setCurrentMatchupIndex(currentMatchupIndex as number)
    })

    socket.on('vote_cast', ({ currentVotes, players }) => {
      setCurrentVotes(currentVotes)
      currentVotesRef.current = currentVotes
      setPlayers(players)
    })

    socket.on('matchup_advanced', ({ matchups, currentMatchupIndex, wasTie }) => {
      const prevIndex = currentMatchupIndex - 1

      if (wasTie && prevIndex >= 0) {
        const completed = matchups[prevIndex] as Matchup
        setTieNotice({ winnerName: completed.winner?.name || 'Someone' })
        window.setTimeout(() => setTieNotice(null), 4500)
      }

      setMatchups(matchups)
      setCurrentMatchupIndex(currentMatchupIndex)
      setCurrentVotes([])
      currentVotesRef.current = []
      if (currentMatchupIndex === 15) setIsGameOver(true)
    })

    socket.on('error', (msg) => alert(msg))
    socket.on('players_update', (updatedPlayers) => setPlayers(updatedPlayers))

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
        currentVotesRef.current = currentVotes
        setIsGameStarted(isGameStarted)
        setIsGameOver(isGameOver)
      }
    )

    return () => {
      socket.off('player_joined')
      socket.off('game_master')
      socket.off('bracket_set')
      socket.off('vote_cast')
      socket.off('matchup_advanced')
      socket.off('error')
      socket.off('players_update')
      socket.off('game_state')
    }
  }, [game, gameId])

  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        setWakeLock(lock)
      } catch (err) {
        console.error(err)
      }
    }

    requestWakeLock()

    return () => {
      if (wakeLock) {
        wakeLock.release().then(() => setWakeLock(null))
      }
    }
  }, [wakeLock])

  useEffect(() => {
    const fetchPublicBrackets = async () => {
      const response = await fetch('/api/public')
      const data = await response.json()
      setPublicBrackets(data)
    }

    fetchPublicBrackets()
  }, [])

  const handleJoin = () => {
    if (gameId && name) {
      socket.emit('join', { gameId, playerName: name })
      localStorage.setItem('playerName', name)
      setHasJoined(true)
    }
  }

  const handleSetBracket = () => {
    if (gameId && code) {
      socket.emit('set_bracket', { gameId, code: code.toLowerCase() })
      localStorage.setItem('code', code.toLowerCase())
    }
  }

  const handleStart = () => {
    socket.emit('start_game', { gameId })
  }

  const hasVoted = currentVotes.some((v) => v.playerId === socket.id)
  const currentMatchup = matchups[currentMatchupIndex]
  const champion = matchups[currentMatchupIndex - 1]?.winner

  return (
    <div className="bn-page bn-page--stadium min-h-screen flex flex-col items-center p-4 gap-4">
      {(!isGameStarted || isGameOver) && (
        <img
          src="/bracket-night-gold.svg"
          alt="Bracket Night"
          className="player-logo"
        />
      )}

      {!hasJoined && (
        <div className="flex-grow flex items-center justify-center w-full">
          <div className="bn-card player-shell p-6">
            <h1 className="player-state-title">Join the night</h1>
            <p className="player-state-copy mb-4">
              Enter the room code from the TV and your display name.
            </p>

            <input
              type="text"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="Game ID"
              className="bn-input"
            />

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="bn-input"
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

      {hasJoined && !isGameStarted && (
        <div className="bn-card player-shell p-6">
          {isGameMaster && !bracket && (
            <div>
              <h1 className="player-state-title">Set the bracket</h1>
              <p className="player-state-copy mb-4">
                You&apos;re the Game Master. Drop in a bracket code to load the field.
              </p>

              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter Bracket Code"
                className="bn-input"
                onKeyUp={(e) => {
                  if (e.key === 'Enter') handleSetBracket()
                }}
              />

              <button type="button" onClick={handleSetBracket} className="bn-btn bn-btn--gold">
                Load Bracket
              </button>
            </div>
          )}

          {isGameMaster && bracket && !isGameStarted && (
            <button type="button" onClick={handleStart} className="bn-btn mt-2">
              Everyone ready — start!
            </button>
          )}

          {!bracket && !isGameMaster && (
            <p className="player-state-copy">Waiting for the bracket to be set…</p>
          )}
          {bracket && !isGameMaster && (
            <p className="player-state-copy">Waiting for the Game Master to begin…</p>
          )}

          <h2 className="bn-display text-xl mt-5 mb-1 text-[var(--gold)] tracking-widest text-center">
            Players in room
          </h2>
          <div className="player-list">
            {players.map((player, index) => (
              <div key={index} className="player-pill">
                {player.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasJoined && isGameStarted && (
        <div className="player-shell w-full">
          {bracket && (
            <div className="text-center mb-3">
              <h2 className="bn-display text-4xl text-[var(--gold-bright)]">{bracket.title}</h2>
              <h3 className="text-[var(--text-muted)] mt-1">{bracket.subtitle}</h3>
            </div>
          )}

          {tieNotice && <CoinTossMobileNotice winnerName={tieNotice.winnerName} />}

          {isGameStarted && !isGameOver && currentMatchup && (
            <VotingCard
              matchup={currentMatchup}
              gameId={gameId}
              playerName={name}
              hasVoted={hasVoted}
            />
          )}

          {isGameOver && (
            <div className="bn-card p-6 game-over-winner">
              <h2 className="player-state-title">Champion</h2>
              <h3 className="text-2xl font-bold text-[var(--winner-highlight)]">
                {champion?.name}
              </h3>
              {champion?.image_url && (
                <img src={champion.image_url} alt={champion.name || 'Winner'} />
              )}
            </div>
          )}
        </div>
      )}

      {isGameMaster && !bracket && (
        <>
          <h2 className="bn-display text-2xl text-[var(--gold)] tracking-widest mt-2">
            Public brackets
          </h2>
          {publicBrackets.map((publicBracket, index) => (
            <div key={index} className="bn-card public-bracket-row">
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
