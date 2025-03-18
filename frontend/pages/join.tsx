/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { socket } from '../lib/socket'
import { Bracket, Matchup, Player } from '../../backend/src/types'
import Head from 'next/head'
import VotingCard from '../components/VotingCard'

export default function Join() {
  // Get game ID from URL
  const router = useRouter()
  const { game } = router.query
  
  // Declare state variables
  const [name, setName] = useState('')
  const [bracketCode, setBracketCode] = useState('')
  const [bracket, setBracket] = useState<Bracket | null>(null)
  const [isGameMaster, setIsGameMaster] = useState(false)
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [currentMatchupIndex, setCurrentMatchupIndex] = useState(0)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentVotes, setCurrentVotes] = useState<{ playerId: string, vote: string }[]>([])
  const [hasJoined, setHasJoined] = useState(false)
  const [gameId, setGameId] = useState('')
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)

  // Load stored name, bracket code and game ID
  useEffect(() => {
    const storedName = localStorage.getItem('playerName')
    if (storedName) {
      setName(storedName)
    }
    
    const storedBracketCode = localStorage.getItem('bracketCode')
    if (storedBracketCode) {
      setBracketCode(storedBracketCode)
    }
    
    if (game) {
      setGameId(game as string)
    }
  }, [game])

  // Set up socket listeners
  useEffect(() => {
    // Check if game ID exists
    if (!game) return

    // On player joined, update players
    socket.on('player_joined', ({ players }) => setPlayers(players))
    
    // First player gets set to game master
    socket.on('game_master', () => setIsGameMaster(true))
    
    // When bracket is set, update bracket, matchups and current matchup index
    socket.on('bracket_set', ({ bracket, matchups, currentMatchupIndex }) => {
      setBracket(bracket as Bracket)
      setMatchups(matchups as Matchup[])
      setCurrentMatchupIndex(currentMatchupIndex as number)
    })
    
    // When vote is cast, update current votes and players
    socket.on('vote_cast', ({ currentVotes, players }) => {
      setCurrentVotes(currentVotes)
      setPlayers(players)
    })
    
    // When matchup advances, update matchups and current matchup index
    socket.on('matchup_advanced', ({ matchups, currentMatchupIndex }) => {
      setMatchups(matchups)
      setCurrentMatchupIndex(currentMatchupIndex)
      setCurrentVotes([])
    })
    
    // When an error occurs, alert the user
    socket.on('error', (msg) => alert(msg))
    
    // When players update, update players
    socket.on('players_update', (updatedPlayers) => {
      setPlayers(updatedPlayers)
    })
    
    // When a full game state is received, update all state variables
    socket.on('game_state', ({ gameId, bracket, matchups, currentMatchupIndex, players, currentVotes, isGameStarted, isGameOver }) => {
      setGameId(gameId)
      setBracket(bracket)
      setMatchups(matchups)
      setCurrentMatchupIndex(currentMatchupIndex)
      setPlayers(players)
      setCurrentVotes(currentVotes)
      setIsGameStarted(isGameStarted)
      setIsGameOver(isGameOver)
    })

    // Clean up listeners
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

  // Request wake lock on mount, so the screen doesn't turn off
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

  // Handle join game from button click
  const handleJoin = () => {
    if (gameId && name) {
      socket.emit('join', { gameId, playerName: name })
      localStorage.setItem('playerName', name)
      setHasJoined(true)
    }
  }

  // Handle set bracket from button click
  const handleSetBracket = () => {
    if (gameId && bracketCode) {
      socket.emit('set_bracket', { gameId, code: bracketCode.toLowerCase() })
      localStorage.setItem('bracketCode', bracketCode.toLowerCase())
    }
  }

  // Handle start game from button click
  const handleStart = () => {
    socket.emit('start_game', { gameId })
  }

  // Check if user has voted
  const hasVoted = currentVotes.some(v => v.playerId === socket.id)

  return (
    <div style={{ padding: '20px' }}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
      </Head>
      
      {/* Check if user needs to join */}
      {!hasJoined && (
        <>
          <h1>Join Game</h1>
          <input
            type="text"
            value={gameId}
            onChange={e => setGameId(e.target.value)}
            placeholder="Game ID"
            style={{ padding: '5px', marginBottom: '10px' }}
          />
          <br />
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your Name"
            style={{ padding: '5px', marginBottom: '10px' }}
            onKeyUp={e => { if (e.key === 'Enter') handleJoin() }}
          />
          <br />
          <button onClick={handleJoin}>Join</button>
        </>
      )}
      
      {/* Check if user has joined and game is pending */}
      {hasJoined && !isGameStarted && (
        <>          
          {/* Check if user is the first player and needs to set the bracket */}
          {isGameMaster && !bracket && (
            <div>
              Bracket Code:
              <br />
              <input
                type="text"
                value={bracketCode}
                onChange={e => setBracketCode(e.target.value)}
                placeholder="Enter Bracket Code"
                style={{ padding: '5px', marginBottom: '10px' }}
                onKeyUp={e => { if (e.key === 'Enter') handleSetBracket() }}
              />
              <br />
              <button onClick={handleSetBracket}>Set Bracket</button>
            </div>
          )}
          
          {/* Check if user is the first player, bracket exists, and game is pending start */}
          {isGameMaster && bracket && !isGameStarted && (
            <button onClick={handleStart}>Everyone ready, start!</button>
          )}
          
          {/* Display message if waiting for bracket to be set */}
          {!bracket && !isGameMaster && <p>Waiting for the bracket to be set...</p>}
          <h2 style={{ fontSize: '1em' }}>Players in game:</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {players.map((player, index) => (
              <div key={index}
                style={{
                  color: 'darkblue',
                  padding: '10px', 
                  border: '1px solid #ccc', 
                  borderRadius: '5px', 
                  backgroundColor: '#f9f9f9', 
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
                }}
              >
              {player.name}
              </div>
            ))}
            </div>
        </>
      )}
      
      {/* Check if user has joined and game has started */}
      {hasJoined && isGameStarted && (
        <>
          <h1>Bracket Night</h1>
          {/* Check if bracket exists */}
          {bracket && <h2>{bracket.title}</h2>}
          <p>Players: {players.length}/10</p>
          {/* Check if bracket exists and currentMatchupIndex is less than matchups length */}
          {isGameStarted && !isGameOver && (
            <div>
              <h2>Vote for your favorite</h2>
              <VotingCard 
                matchup={matchups[currentMatchupIndex]} 
                gameId={gameId} 
                playerName={name} 
                hasVoted={hasVoted} 
              />
            </div>
          )}
          {/* Check if bracket exists and currentMatchupIndex is equal to matchups length */}
          {isGameOver && (
            <>
              <h2>Game Over!</h2>
              <h3>Winner: {matchups[currentMatchupIndex - 1].winner?.name}</h3>
              <img src={matchups[currentMatchupIndex - 1].winner?.image_url} alt="Winner" style={{ width: '200px', height: '200px' }} />
            </>
          )}
        </>
      )}
    </div>
  )
}
