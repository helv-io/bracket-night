/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { socket } from '../lib/socket'
import { Matchup, Player } from '../../backend/src/types'
import Head from 'next/head'

export default function Join() {
  const router = useRouter()
  const { session } = router.query
  const [name, setName] = useState('')
  const [bracketCode, setBracketCode] = useState('')
  const [bracketName, setBracketName] = useState('')
  const [isFirstPlayer, setIsFirstPlayer] = useState(false)
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [currentMatchupIndex, setCurrentMatchupIndex] = useState(0)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentVotes, setCurrentVotes] = useState<{ playerId: string, vote: string }[]>([])
  const [hasJoined, setHasJoined] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [isBracketSet, setIsBracketSet] = useState(false)

  useEffect(() => {
    const storedName = localStorage.getItem('playerName')
    if (storedName) {
      setName(storedName)
    }
    const storedBracketCode = localStorage.getItem('bracketCode')
    if (storedBracketCode) {
      setBracketCode(storedBracketCode)
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
    socket.on('bracket_set', ({ matchups, currentMatchupIndex, bracketName }) => {
      setMatchups(matchups)
      setCurrentMatchupIndex(currentMatchupIndex)
      setBracketName(bracketName)
      setIsBracketSet(true)
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
    socket.on('players_update', (updatedPlayers) => {
      setPlayers(updatedPlayers)
    })
    socket.on('game_started', () => {
      setGameStarted(true)
    })

    return () => {
      socket.off('player_joined')
      socket.off('enter_bracket_code')
      socket.off('bracket_set')
      socket.off('vote_cast')
      socket.off('matchup_advanced')
      socket.off('error')
      socket.off('players_update')
      socket.off('game_started')
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
      socket.emit('set_bracket', { sessionId: sessionId, code: bracketCode.toLowerCase() })
      localStorage.setItem('bracketCode', bracketCode.toLowerCase())
      setBracketName('Bracket Name') // Replace with actual bracket name logic
    }
  }

  const startGame = () => {
    socket.emit('start_game')
  }

  const hasVoted = currentVotes.some(v => v.playerId === socket.id)
  console.log(hasVoted)

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
          {bracketCode && (
            <p style={{ fontSize: '0.8em', marginTop: '10px' }}>
              Bracket: {bracketName}
            </p>
          )}
        </>
      ) : (
        <>
          {!gameStarted ? (
            <>
              <h2 style={{ fontSize: '1em' }}>Waiting for players...</h2>
              <ul>
                {players.map((player, index) => (
                  <li key={index}>{player.name}</li>
                ))}
              </ul>
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
                  <button onClick={handleSetBracket}>Set Bracket</button>
                  {isBracketSet && (
                    <button onClick={startGame}>Everybody&apos;s in, let&apos;s go!</button>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
                <h1>Bracket Night</h1>
                {bracketName && <h2>{bracketName}</h2>}
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
              {matchups.length > 0 && currentMatchupIndex < matchups.length && (
              <div>
                <h2>Vote for your favorite</h2>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  <div onClick={() => socket.emit('vote', { sessionId, playerId: matchups[currentMatchupIndex].left?.id })}>
                    <img src={matchups[currentMatchupIndex].left?.image_url} alt={matchups[currentMatchupIndex].left?.name} style={{ width: '150px', height: '150px' }} />
                    <p>{matchups[currentMatchupIndex].left?.name}</p>
                  </div>
                  <div onClick={() => socket.emit('vote', { sessionId, playerId: matchups[currentMatchupIndex].right?.id })}>
                    <img src={matchups[currentMatchupIndex].right?.image_url} alt={matchups[currentMatchupIndex].right?.name} style={{ width: '150px', height: '150px' }} />
                    <p>{matchups[currentMatchupIndex].right?.name}</p>
                  </div>
                </div>
              </div>
              )}
              {matchups.length > 0 && currentMatchupIndex === matchups.length && (
              <>
                <h2>Game Over!</h2>
                <h3>Winner: {matchups[currentMatchupIndex - 1].winner?.name}</h3>
                <img src={matchups[currentMatchupIndex - 1].winner?.image_url} alt="Winner" style={{ width: '200px', height: '200px' }} />
              </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}