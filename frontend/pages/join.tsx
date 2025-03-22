/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { socket } from '../lib/socket'
import { Bracket, Matchup, Player } from '../../backend/src/types'
import VotingCard from '../components/VotingCard'

const Join = () => {
  // Get game ID from URL
  const router = useRouter()
  const { game } = router.query
  
  // Declare state variables
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
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
    
    const storedCode = localStorage.getItem('code')
    if (storedCode) {
      setCode(storedCode)
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
      if (currentMatchupIndex === 15) setIsGameOver(true)
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
    if (gameId && code) {
      socket.emit('set_bracket', { gameId, code: code.toLowerCase() })
      localStorage.setItem('code', code.toLowerCase())
    }
  }

  // Handle start game from button click
  const handleStart = () => {
    socket.emit('start_game', { gameId })
  }

  // Check if user has voted
  const hasVoted = currentVotes.some(v => v.playerId === socket.id)

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center p-4">
      {/* Logo */}
      <img
        src="/bracket-night-gold.svg"
        alt="Bracket Night Logo"
        className="w-full sm:w-1/3 object-cover mb-4"
      />
  
      {/* Join Form - Vertically Centered */}
      {!hasJoined && (
        <div className="flex-grow flex items-center justify-center w-full">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
            <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Join Game</h1>
  
            <input
              type="text"
              value={gameId}
              onChange={e => setGameId(e.target.value)}
              placeholder="Game ID"
              className="w-full p-2 mb-4 border border-gray-300 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
  
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your Name"
              className="w-full p-2 mb-4 border border-gray-300 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              onKeyUp={e => { if (e.key === 'Enter') handleJoin() }}
            />
  
            <button onClick={handleJoin} className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Join</button>
          </div>
        </div>
      )}
  
      {/* Waiting Section */}
      {hasJoined && !isGameStarted && (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
          {isGameMaster && !bracket && (
            <div>
              <label className="block mb-2 text-gray-900 dark:text-gray-100">Bracket Code:</label>
  
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Enter Bracket Code"
                className="w-full p-2 mb-4 border border-gray-300 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                onKeyUp={e => { if (e.key === 'Enter') handleSetBracket() }}
              />
  
              <button onClick={handleSetBracket} className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600">Set Bracket</button>
            </div>
          )}
  
          {isGameMaster && bracket && !isGameStarted && (
            <button onClick={handleStart} className="w-full bg-purple-500 text-white p-2 rounded hover:bg-purple-600 mt-4">Everyone ready, start!</button>
          )}
  
          {!bracket && !isGameMaster && <p className="text-center text-gray-500 dark:text-gray-400">Waiting for the bracket to be set... ⏳</p>}
          {bracket && !isGameMaster && <p className="text-center text-gray-500 dark:text-gray-400">Waiting for the Game Master to begin... 🤔</p>}
  
          <h2 className="text-lg font-semibold mt-4 text-gray-900 dark:text-gray-100">Players in game:</h2>
          <div className="flex flex-wrap gap-4 mt-2">
            {players.map((player, index) => (
              <div key={index} className="text-blue-700 dark:text-blue-300 p-4 border border-gray-300 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-700 shadow">
                {player.name}
              </div>
            ))}
          </div>
        </div>
      )}
  
      {/* Game Section */}
      {hasJoined && isGameStarted && (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-2xl text-center">
          <img
            src="/bracket-night-gold.svg"
            alt="Bracket Night Logo"
            className="w-full sm:w-1/3 mx-auto mb-4"
          />
  
          {bracket && (
            <>
              <h2 className="text-4xl font-extrabold mb-2 text-gray-900 dark:text-gray-100" style={{ textShadow: '2px 2px 4px var(--accent)' }}>{bracket.title}</h2>
              <h3 className="text-lg font-medium mb-4 text-gray-700 dark:text-gray-300">{bracket.subtitle}</h3>
            </>
          )}
  
          {isGameStarted && !isGameOver && (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Vote now! 🗳️</h2>
              <VotingCard 
                matchup={matchups[currentMatchupIndex]} 
                gameId={gameId} 
                playerName={name} 
                hasVoted={hasVoted} 
              />
            </div>
          )}
  
          {isGameOver && (
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Game Over!</h2>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Winner: {matchups[currentMatchupIndex - 1].winner?.name} 🏆</h3>
              <img src={matchups[currentMatchupIndex - 1].winner?.image_url} alt="Winner" className="w-48 h-48 mx-auto rounded-full shadow-lg mb-4" />
            </div>
          )}
        </div>
      )}
  
      {/* Footer */}
      <footer className="mt-auto w-full bg-gray-800 dark:bg-gray-800 text-white dark:text-gray-200 p-2 sm:p-4 text-center">
        <p className="text-xs sm:text-sm">
          Bracket Night was lovingly crafted ❤️ by Helvio for the world.<br/> 
          A heartfelt thank you to my amazing wife Jackie for her unwavering support and endless snacks 🍿 during development.<br/>
          If you’d like to show some love, consider <a href="https://buymeacoffee.com/helvio" className="text-yellow-400 hover:underline" target="_blank" rel="noopener noreferrer">donating</a>—it’ll go towards something shiny for Jackie! 💎
        </p>
      </footer>
    </div>
  )
}

export default Join