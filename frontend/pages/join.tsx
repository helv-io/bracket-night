/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { socket } from '../lib/socket'
import { Bracket, Matchup, Player } from '../../backend/src/types'
import Head from 'next/head'
import VotingCard from '../components/VotingCard'

export default function Join() {
  const router = useRouter()
  const { session } = router.query
  const [name, setName] = useState('')
  const [bracketCode, setBracketCode] = useState('')
  const [bracket, setBracket] = useState<Bracket | null>(null)
  const [isFirstPlayer, setIsFirstPlayer] = useState(false)
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [currentMatchupIndex, setCurrentMatchupIndex] = useState(0)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentVotes, setCurrentVotes] = useState<{ playerId: string, vote: string }[]>([])
  const [hasJoined, setHasJoined] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)
  const [gameStarted, setGameStarted] = useState(false)

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
    socket.on('bracket_set', ({ bracket, matchups, currentMatchupIndex }) => {
      setBracket(bracket as Bracket)
      setMatchups(matchups as Matchup[])
      setCurrentMatchupIndex(currentMatchupIndex as number)
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
    }
  }

  const startGame = () => {
    socket.emit('start_game')
    setGameStarted(true)
  }

  const hasVoted = currentVotes.some(v => v.playerId === socket.id)

  return (
    <div style={{ padding: '20px' }}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
      </Head>
      {bracket && <h1>{bracket.title}</h1>}
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
          {!gameStarted ? (
            <> 
              {!bracket && !isFirstPlayer && <p>Waiting for the bracket to be set...</p>}
              <h2 style={{ fontSize: '1em' }}>Waiting for players...</h2>
              <ul>
                {players.map((player, index) => (
                  <li key={index}>{player.name}</li>
                ))}
              </ul>
              {isFirstPlayer && !bracket && (
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
              {isFirstPlayer && bracket && !gameStarted && (
                <button onClick={startGame}>Everybody&apos;s in, let&apos;s go!</button>
              )}
            </>
          ) : (
            <>
              <h1>Bracket Night</h1>
              {bracket && <h2>{bracket.title}</h2>}
              <p>Players: {players.length}/10</p>
              {isFirstPlayer && !bracket && (
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
              {bracket && currentMatchupIndex < matchups.length && (
              <div>
                <h2>Vote for your favorite</h2>
                <VotingCard 
                  matchup={matchups[currentMatchupIndex]} 
                  sessionId={sessionId} 
                  playerName={name} 
                  hasVoted={hasVoted} 
                />
              </div>
              )}
              {bracket && currentMatchupIndex === matchups.length && (
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