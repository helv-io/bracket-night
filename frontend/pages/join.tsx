import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { socket } from '../lib/socket'
import VotingCard from '../components/VotingCard'
import { Matchup, Player } from '../../backend/src/types'
import Head from 'next/head'

export default function Join() {
  const router = useRouter()
  const { session } = router.query
  const [name, setName] = useState('')
  const [bracketCode, setBracketCode] = useState('')
  const [isFirstPlayer, setIsFirstPlayer] = useState(false)
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [currentMatchupIndex, setCurrentMatchupIndex] = useState(0)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentVotes, setCurrentVotes] = useState<{ playerId: string, vote: string }[]>([])
  const [hasJoined, setHasJoined] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)

  useEffect(() => {
    const storedName = localStorage.getItem('playerName')
    if (storedName) {
      setName(storedName)
    }
  }, [])

  useEffect(() => {
    if (session) {
      setSessionId(session as string)
    }
  }, [session])

  useEffect(() => {
    if (!session) return

    socket.on('player_joined', ({ players }) => setPlayers(players))
    socket.on('enter_bracket_code', () => setIsFirstPlayer(true))
    socket.on('bracket_set', ({ matchups, currentMatchupIndex }) => {
      setMatchups(matchups)
      setCurrentMatchupIndex(currentMatchupIndex)
    })
    socket.on('vote_cast', ({ currentVotes, players }) => {
      setCurrentVotes(currentVotes)
      setPlayers(players)
    })
    socket.on('matchup_advanced', ({ matchups, currentMatchupIndex }) => {
      setMatchups(matchups)
      setCurrentMatchupIndex(currentMatchupIndex)
      setCurrentVotes([])
    })
    socket.on('error', (msg) => alert(msg))

    return () => {
      socket.off('player_joined')
      socket.off('enter_bracket_code')
      socket.off('bracket_set')
      socket.off('vote_cast')
      socket.off('matchup_advanced')
      socket.off('error')
    }
  }, [session])

  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        const wakeLock = await navigator.wakeLock.request('screen')
        setWakeLock(wakeLock)
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

  const handleJoin = () => {
    if (sessionId && name) {
      socket.emit('join', { sessionId: sessionId, playerName: name })
      localStorage.setItem('playerName', name)
      setHasJoined(true)
    }
  }

  const handleSetBracket = () => {
    if (sessionId && bracketCode) {
      socket.emit('set_bracket', { sessionId: sessionId, code: bracketCode })
    }
  }

  const hasVoted = currentVotes.some(v => v.playerId === socket.id)

  return (
    <div style={{ padding: '20px' }}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
      </Head>
      {!hasJoined ? (
        <>
          <h1>Join Game</h1>
          <input
            type="text"
            value={sessionId}
            onChange={e => setSessionId(e.target.value)}
            placeholder="Session ID"
            style={{ padding: '5px', marginBottom: '10px' }}
          />
          <br />
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your Name"
            style={{ padding: '5px', marginBottom: '10px' }}
            onKeyUp={e => {
              if (e.key === 'Enter') {
                handleJoin()
              }
            }}
          />
          <br />
          <button onClick={handleJoin}>Join</button>
        </>
      ) : (
        <>
          <h1>Bracket Night</h1>
          <p>Players: {players.length}/10</p>
          {isFirstPlayer && matchups.length === 0 && (
            <div>
              <input
                type="text"
                value={bracketCode}
                onChange={e => setBracketCode(e.target.value)}
                placeholder="Enter Bracket Code"
                style={{ padding: '5px', marginBottom: '10px' }}
                onKeyUp={e => {
                  if (e.key === 'Enter') {
                    handleSetBracket()
                  }
                }}
              />
              <br />
              <button onClick={handleSetBracket}>Set Bracket</button>
            </div>
          )}
          {matchups.length === 0 && !isFirstPlayer && <p>Waiting for the bracket to be set...</p>}
          {matchups.length > 0 && currentMatchupIndex < matchups.length && players.length >= 3 && (
            <VotingCard
              playerName={name}
              matchup={matchups[currentMatchupIndex]}
              sessionId={sessionId as string}
              hasVoted={hasVoted}
            />
          )}
          {matchups.length > 0 && currentMatchupIndex === matchups.length && <h2>Game Over!</h2>}
        </>
      )}
    </div>
  )
}