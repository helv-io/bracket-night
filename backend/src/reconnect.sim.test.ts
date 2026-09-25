/**
 * Live Socket.IO simulation. A dropped pipe is a new socket id.
 * The seat, the vote, the coin, and the TV room must survive that.
 *
 * Env is set before the game module loads (config captures MAX_PLAYERS / DB_PATH).
 */
process.env.NODE_ENV = 'test'
process.env.BRACKET_RANDOM_ROOMS = '1'
process.env.COIN_TIMEOUT_MS = '0'
process.env.MAX_PLAYERS = '3'
process.env.DB_FOLDER = '/tmp/bn-cook-db'
process.env.DB_PATH = '/tmp/bn-cook-db/bracket.db'

import assert from 'assert'
import fs from 'fs'
import http from 'http'
import type { AddressInfo } from 'net'
import type { Server as IoServer } from 'socket.io'
import type { Socket } from 'socket.io-client'
import type { PlayerSelf, PublicGameState } from './types'

fs.mkdirSync(process.env.DB_FOLDER, { recursive: true })

type NightSocket = Socket
type Advance = { currentMatchupIndex: number, wasTie: boolean }

function waitFor<T>(socket: NightSocket, event: string, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent)
      reject(new Error(`timeout waiting for ${event}`))
    }, ms)
    const onEvent = (payload: T) => {
      clearTimeout(timer)
      resolve(payload)
    }
    socket.once(event, onEvent)
  })
}

function waitForMatch<T>(
  socket: NightSocket,
  event: string,
  pred: (payload: T) => boolean,
  ms = 3000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent)
      reject(new Error(`timeout waiting for matching ${event}`))
    }, ms)
    const onEvent = (payload: T) => {
      if (!pred(payload)) return
      clearTimeout(timer)
      socket.off(event, onEvent)
      resolve(payload)
    }
    socket.on(event, onEvent)
  })
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function digest(state: PublicGameState) {
  return JSON.stringify({
    gameId: state.gameId,
    ids: state.players.map((player) => player.id),
    names: state.players.map((player) => player.name),
    connected: state.players.map((player) => player.connected),
    index: state.currentMatchupIndex,
    phase: state.phase,
    votes: state.currentVotes,
    code: state.bracket?.code ?? null,
    gm: state.gameMasterId,
    started: state.isGameStarted,
    over: state.isGameOver,
    coin: state.coin
      ? { side: state.coin.winnerSide, index: state.coin.matchupIndex, winner: state.coin.winner.id }
      : null,
    winners: state.matchups.map((matchup) => matchup.winner?.id ?? null),
  })
}

function assertNoSecrets(state: PublicGameState, secrets: string[]) {
  const raw = JSON.stringify(state)
  for (const secret of secrets) {
    assert.ok(secret.length > 8, 'secret should be long enough to search for')
    assert.ok(!raw.includes(secret), 'public game_state leaked a secret')
  }
}

async function stage(name: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (err) {
    const message = err instanceof Error ? err.stack || err.message : String(err)
    throw new Error(`[${name}] ${message}`)
  }
}

async function main() {
  const { Server } = await import('socket.io')
  const { io: clientIo } = await import('socket.io-client')
  const { randomBytes } = await import('crypto')
  const { Game } = await import('./game')

  const token = () => randomBytes(16).toString('hex')
  const server = http.createServer()
  const io: IoServer = new Server(server, { cors: { origin: '*' } })
  const game = new Game(io)
  const opened: NightSocket[] = []

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const port = (server.address() as AddressInfo).port
  const url = `http://127.0.0.1:${port}`

  function connect() {
    const socket = clientIo(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    opened.push(socket)
    return waitFor<void>(socket, 'connect').then(() => socket)
  }

  async function createRoom() {
    const host = await connect()
    const created = waitFor<{ gameId: string, hostToken: string }>(host, 'game_created')
    const stateP = waitFor<PublicGameState>(host, 'game_state')
    host.emit('create_game')
    const msg = await created
    const state = await stateP
    assert.ok(msg.hostToken.length >= 16, 'host token minted')
    assert.notStrictEqual(msg.gameId, host.id, 'game id is not the host socket id')
    assert.notStrictEqual(msg.hostToken, host.id, 'host token is not the host socket id')
    assert.strictEqual(state.gameId, msg.gameId)
    assert.strictEqual(state.phase, 'lobby')
    return { host, gameId: msg.gameId, hostToken: msg.hostToken }
  }

  async function join(gameId: string, name: string, playerToken: string) {
    const phone = await connect()
    const joinedP = waitFor<PlayerSelf>(phone, 'joined')
    const stateP = waitFor<PublicGameState>(phone, 'game_state')
    phone.emit('join', { gameId, playerName: name, playerToken })
    const joined = await joinedP
    const state = await stateP
    assert.notStrictEqual(joined.playerId, phone.id, `${name} player id must not be the socket id`)
    assert.notStrictEqual(joined.playerId, playerToken, `${name} player id must not be the token`)
    assert.strictEqual(joined.playerToken, playerToken)
    return { phone, joined, state }
  }

  try {
    await stage('mid-lobby reconnect + host reattach', async () => {
      const room = await createRoom()
      const tokenA = token()
      const tokenB = token()
      const ava = await join(room.gameId, 'Ava', tokenA)
      assert.strictEqual(ava.joined.isGameMaster, true)
      assert.strictEqual(ava.joined.resumed, false)
      assert.strictEqual(ava.state.players.length, 1)
      assertNoSecrets(ava.state, [room.hostToken, tokenA])

      const replayP = new Promise<{ created: { gameId: string, hostToken: string }, state: PublicGameState }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout waiting for create replay')), 3000)
        room.host.once('game_created', (created: { gameId: string, hostToken: string }) => {
          room.host.once('game_state', (state: PublicGameState) => {
            clearTimeout(timer)
            resolve({ created, state })
          })
        })
      })
      room.host.emit('create_game')
      const { created: createdMsg, state: replay } = await replayP
      assert.strictEqual(createdMsg.gameId, room.gameId, 'second create_game must not mint a new room')
      assert.strictEqual(createdMsg.hostToken, room.hostToken, 'second create_game must keep the host key')
      assert.strictEqual(replay.players.length, 1, 'second create_game must not wipe the seat')
      assert.strictEqual(replay.players[0].id, ava.joined.playerId)

      const ben = await join(room.gameId, 'Ben', tokenB)
      assert.strictEqual(ben.joined.isGameMaster, false)
      assert.strictEqual(ben.state.players.length, 2)

      const stolen = waitFor<string>(ben.phone, 'error')
      ben.phone.emit('join', { gameId: room.gameId, playerName: 'Ava', playerToken: token() })
      assert.strictEqual(await stolen, 'That name is already taken')

      const notMaster = waitFor<string>(ben.phone, 'error')
      ben.phone.emit('set_bracket', { gameId: room.gameId, code: 'demo' })
      assert.strictEqual(await notMaster, 'Only the game master can set the bracket')

      const dropped = waitForMatch<PublicGameState>(room.host, 'game_state', (state) => {
        const seat = state.players.find((player) => player.id === ava.joined.playerId)
        return Boolean(seat && !seat.connected && state.players.length === 2)
      })
      ava.phone.disconnect()
      const whileGone = await dropped
      assert.strictEqual(whileGone.gameMasterId, ava.joined.playerId)
      assert.strictEqual(whileGone.bracket, null)
      assertNoSecrets(whileGone, [room.hostToken, tokenA, tokenB])

      const nameThief = await connect()
      const nameErr = waitFor<string>(nameThief, 'error')
      nameThief.emit('join', { gameId: room.gameId, playerName: 'Ava', playerToken: token() })
      assert.strictEqual(await nameErr, 'That name is already taken')

      const resumed = await join(room.gameId, 'Ava', tokenA)
      assert.strictEqual(resumed.joined.resumed, true)
      assert.strictEqual(resumed.joined.playerId, ava.joined.playerId)
      assert.strictEqual(resumed.joined.isGameMaster, true)
      assert.notStrictEqual(resumed.phone.id, ava.phone.id, 'resume uses a new socket')
      assert.strictEqual(resumed.state.players.length, 2)
      assert.ok(resumed.state.players.every((player) => player.connected))

      const moved = waitFor<void>(resumed.phone, 'session_moved')
      const otherTab = await connect()
      const otherJoined = waitFor<PlayerSelf>(otherTab, 'joined')
      otherTab.emit('join', { gameId: room.gameId, playerName: 'Ava', playerToken: tokenA })
      await moved
      const tab = await otherJoined
      assert.strictEqual(tab.playerId, ava.joined.playerId)
      const staleVote = waitFor<string>(resumed.phone, 'error')
      resumed.phone.emit('vote', { gameId: room.gameId, choice: 0 })
      assert.strictEqual(await staleVote, 'Join the room first')

      const bracketReady = waitForMatch<PublicGameState>(
        room.host,
        'game_state',
        (state) => state.bracket?.code === 'demo' && state.matchups.length === 15
      )
      otherTab.emit('set_bracket', { gameId: room.gameId, code: 'DEMO' })
      const withBracket = await bracketReady
      assert.strictEqual(withBracket.players.length, 2)
      assert.strictEqual(withBracket.phase, 'lobby')

      const beforeDrop = digest(withBracket)
      const hostGone = waitFor<PublicGameState>(ben.phone, 'game_state')
      room.host.disconnect()
      const afterHostGone = await hostGone
      assert.strictEqual(digest(afterHostGone), beforeDrop, 'host disconnect must not change the night')

      const intruder = await connect()
      let leaked = 0
      ben.phone.on('game_state', () => { leaked += 1 })
      const failed = waitFor<{ gameId?: string }>(intruder, 'host_attach_failed')
      intruder.emit('host_attach', { gameId: room.gameId, hostToken: 'nope-token-value' })
      await failed
      await delay(40)
      assert.strictEqual(leaked, 0, 'bad host token must not broadcast')
      ben.phone.removeAllListeners('game_state')

      const tv = await connect()
      const attached = waitFor<PublicGameState>(tv, 'game_state')
      tv.emit('host_attach', { gameId: room.gameId, hostToken: room.hostToken })
      const restored = await attached
      assert.strictEqual(digest(restored), beforeDrop, 'host reattach restores the same night')
    })

    await stage('mid-vote disconnect and resume', async () => {
      const room = await createRoom()
      const tokenA = token()
      const tokenB = token()
      const ava = await join(room.gameId, 'Ava', tokenA)
      const ben = await join(room.gameId, 'Ben', tokenB)
      const bracketReady = waitForMatch<PublicGameState>(room.host, 'game_state', (state) => state.bracket?.code === 'demo')
      ava.phone.emit('set_bracket', { gameId: room.gameId, code: 'demo' })
      const field = await bracketReady
      const leftId = field.matchups[0].left?.id
      const rightId = field.matchups[0].right?.id
      assert.ok(leftId && rightId)

      const started = waitForMatch<PublicGameState>(room.host, 'game_state', (state) => state.phase === 'voting')
      ava.phone.emit('start_game', { gameId: room.gameId })
      await started

      const voted = waitForMatch<PublicGameState>(
        room.host,
        'game_state',
        (state) => state.currentVotes.some((vote) => vote.playerId === ava.joined.playerId && vote.choice === 0)
      )
      ava.phone.emit('vote', { gameId: room.gameId, choice: 0 })
      const oneVote = await voted
      assert.strictEqual(oneVote.currentMatchupIndex, 0)
      assert.strictEqual(oneVote.phase, 'voting')

      ava.phone.disconnect()
      const gone = await waitForMatch<PublicGameState>(room.host, 'game_state', (state) => {
        const seat = state.players.find((player) => player.id === ava.joined.playerId)
        return Boolean(seat && !seat.connected && state.currentVotes.length === 1)
      })
      assert.strictEqual(gone.currentVotes[0].playerId, ava.joined.playerId)
      assert.strictEqual(gone.currentVotes[0].choice, 0)
      assert.strictEqual(gone.matchups[0].winner, null, 'a single vote must not advance the bracket')

      const hostGone = waitFor<PublicGameState>(ben.phone, 'game_state')
      const snapshot = digest(gone)
      room.host.disconnect()
      const whileTvDown = await hostGone
      assert.strictEqual(digest(whileTvDown), snapshot, 'TV drop mid-vote must not clear the vote')

      const tv = await connect()
      const attached = waitForMatch<PublicGameState>(tv, 'game_state', (state) => state.currentVotes.length === 1)
      tv.emit('host_attach', { gameId: room.gameId, hostToken: room.hostToken })
      const tvBack = await attached
      assert.strictEqual(digest(tvBack), snapshot)

      const back = await join(room.gameId, 'Ava', tokenA)
      assert.strictEqual(back.joined.playerId, ava.joined.playerId)
      assert.strictEqual(back.joined.hasVoted, true)
      assert.strictEqual(back.joined.choice, 0)
      const status = waitFor<{ hasVoted: boolean, choice: number | null }>(back.phone, 'vote_status')
      back.phone.emit('vote', { gameId: room.gameId, choice: 1 })
      const still = await status
      assert.strictEqual(still.hasVoted, true)
      assert.strictEqual(still.choice, 0, 'a second vote must not change the locked choice')

      const benGone = waitForMatch<PublicGameState>(tv, 'game_state', (state) => {
        const seat = state.players.find((player) => player.id === ben.joined.playerId)
        return Boolean(seat && !seat.connected && state.currentMatchupIndex === 0 && state.currentVotes.length === 1)
      })
      ben.phone.disconnect()
      await benGone

      const benBack = await join(room.gameId, 'Ben', tokenB)
      assert.strictEqual(benBack.joined.playerId, ben.joined.playerId)
      assert.strictEqual(benBack.joined.hasVoted, false)
      assert.strictEqual(benBack.joined.choice, null)

      let tossed = false
      tv.on('coin_toss', () => { tossed = true })
      const advanced = waitFor<Advance>(tv, 'matchup_advanced')
      const next = waitForMatch<PublicGameState>(tv, 'game_state', (state) => state.currentMatchupIndex === 1)
      benBack.phone.emit('vote', { gameId: room.gameId, choice: 0 })
      const advance = await advanced
      const after = await next
      assert.strictEqual(advance.wasTie, false)
      assert.strictEqual(tossed, false)
      assert.strictEqual(after.phase, 'voting')
      assert.strictEqual(after.currentVotes.length, 0)
      assert.strictEqual(after.matchups[0].winner?.id, leftId)
      assert.strictEqual(after.matchups[8].left?.id, leftId)
      assert.strictEqual(after.players[0].id, ava.joined.playerId)
      assert.strictEqual(after.players[1].id, ben.joined.playerId)
    })

    await stage('mid-coin disconnect, host replay, late reconnect', async () => {
      const room = await createRoom()
      const tokenA = token()
      const tokenB = token()
      const ava = await join(room.gameId, 'Ava', tokenA)
      const ben = await join(room.gameId, 'Ben', tokenB)
      const bracketReady = waitForMatch<PublicGameState>(room.host, 'game_state', (state) => Boolean(state.bracket))
      ava.phone.emit('set_bracket', { gameId: room.gameId, code: 'demo' })
      await bracketReady
      const started = waitForMatch<PublicGameState>(room.host, 'game_state', (state) => state.phase === 'voting')
      ava.phone.emit('start_game', { gameId: room.gameId })
      await started

      ava.phone.emit('vote', { gameId: room.gameId, choice: 0 })
      const coinP = waitForMatch<PublicGameState>(room.host, 'game_state', (state) => state.phase === 'coin')
      ben.phone.emit('vote', { gameId: room.gameId, choice: 1 })
      const coinState = await coinP
      assert.ok(coinState.coin, 'tie opens a server-owned coin')
      assert.strictEqual(coinState.currentMatchupIndex, 0)
      assert.strictEqual(coinState.matchups[0].winner, null, 'bracket waits for the toss')
      assert.strictEqual(coinState.coin.matchupIndex, 0)
      assert.ok(coinState.coin.winnerSide === 0 || coinState.coin.winnerSide === 1)
      const winnerId = coinState.coin.winner.id
      const sideId = coinState.coin.winnerSide === 0 ? coinState.coin.left.id : coinState.coin.right.id
      assert.strictEqual(winnerId, sideId)
      const coinDigest = digest(coinState)

      room.host.disconnect()
      ava.phone.disconnect()
      const avaBack = await join(room.gameId, 'Ava', tokenA)
      assert.strictEqual(avaBack.joined.playerId, ava.joined.playerId)
      assert.strictEqual(avaBack.state.phase, 'coin')
      assert.strictEqual(avaBack.state.coin?.winnerSide, coinState.coin.winnerSide)
      assert.strictEqual(avaBack.state.coin?.winner.id, winnerId)
      assert.strictEqual(avaBack.state.matchups[0].winner, null)

      const closed = waitFor<string>(avaBack.phone, 'error')
      avaBack.phone.emit('vote', { gameId: room.gameId, choice: 0 })
      assert.strictEqual(await closed, 'Voting is closed')
      assert.strictEqual(avaBack.state.currentMatchupIndex, 0)

      const tv = await connect()
      const attached = waitForMatch<PublicGameState>(tv, 'game_state', (state) => state.phase === 'coin')
      tv.emit('host_attach', { gameId: room.gameId, hostToken: room.hostToken })
      const tvCoin = await attached
      assert.strictEqual(tvCoin.coin?.winnerSide, coinState.coin.winnerSide)
      assert.strictEqual(tvCoin.coin?.startedAt, coinState.coin.startedAt)
      assert.strictEqual(digest(tvCoin), coinDigest, 'TV reattach mid-coin keeps the toss and the seats')
      assert.strictEqual(tvCoin.players.find((player) => player.id === ava.joined.playerId)?.connected, true)
      assert.strictEqual(tvCoin.players.find((player) => player.id === ben.joined.playerId)?.connected, true)
      assert.deepStrictEqual(
        tvCoin.players.map((player) => player.id),
        coinState.players.map((player) => player.id)
      )

      const advanced = waitFor<Advance>(tv, 'matchup_advanced')
      const next = waitForMatch<PublicGameState>(tv, 'game_state', (state) => state.phase === 'voting' && state.currentMatchupIndex === 1)
      tv.emit('coin_complete', { gameId: room.gameId, hostToken: room.hostToken })
      const advance = await advanced
      const after = await next
      assert.strictEqual(advance.wasTie, true)
      assert.strictEqual(after.coin, null)
      assert.strictEqual(after.matchups[0].winner?.id, winnerId)
      assert.strictEqual(after.matchups[8].left?.id, winnerId)
      assert.strictEqual(after.currentVotes.length, 0)

      const advancesBefore = 1
      let extra = 0
      tv.on('matchup_advanced', () => { extra += 1 })
      tv.emit('coin_complete', { gameId: room.gameId, hostToken: 'wrong-host-token' })
      tv.emit('coin_complete', { gameId: room.gameId, hostToken: room.hostToken })
      await delay(50)
      assert.strictEqual(extra, 0, 'second coin_complete and a bad token must not advance again')
      assert.strictEqual(advancesBefore, 1)

      avaBack.phone.disconnect()
      const late = await join(room.gameId, 'Ava', tokenA)
      assert.strictEqual(late.joined.playerId, ava.joined.playerId, 'late reconnect keeps the seat')
      assert.strictEqual(late.joined.hasVoted, false)
      assert.strictEqual(late.joined.choice, null)
      assert.strictEqual(late.state.phase, 'voting')
      assert.strictEqual(late.state.currentMatchupIndex, 1)
      assert.strictEqual(late.state.matchups[0].winner?.id, winnerId)

      const locked = waitForMatch<PublicGameState>(
        tv,
        'game_state',
        (state) => state.currentVotes.some((vote) => vote.playerId === ava.joined.playerId)
      )
      late.phone.emit('vote', { gameId: room.gameId, choice: 1 })
      const lateVote = await locked
      assert.strictEqual(lateVote.currentMatchupIndex, 1, 'one late vote does not skip the matchup')
      assert.strictEqual(lateVote.phase, 'voting')
    })

    await stage('stranger after start and a full room', async () => {
      const room = await createRoom()
      const tokenCy = token()
      const seats = [
        await join(room.gameId, 'Ava', token()),
        await join(room.gameId, 'Ben', token()),
        await join(room.gameId, 'Cy', tokenCy),
      ]
      const ready = waitForMatch<PublicGameState>(room.host, 'game_state', (state) => Boolean(state.bracket))
      seats[0].phone.emit('set_bracket', { gameId: room.gameId, code: 'demo' })
      await ready
      const started = waitForMatch<PublicGameState>(room.host, 'game_state', (state) => state.isGameStarted)
      seats[0].phone.emit('start_game', { gameId: room.gameId })
      await started

      const stranger = await connect()
      const err = waitFor<string>(stranger, 'error')
      stranger.emit('join', { gameId: room.gameId, playerName: 'Dee', playerToken: token() })
      assert.strictEqual(await err, 'Game has already started')

      seats[2].phone.disconnect()
      await waitForMatch<PublicGameState>(room.host, 'game_state', (state) => {
        const seat = state.players.find((player) => player.id === seats[2].joined.playerId)
        return Boolean(seat && !seat.connected)
      })
      const thief = await connect()
      const taken = waitFor<string>(thief, 'error')
      thief.emit('join', { gameId: room.gameId, playerName: 'Cy', playerToken: token() })
      assert.strictEqual(await taken, 'Game has already started')

      const fourth = await connect()
      const full = waitFor<string>(fourth, 'error')
      fourth.emit('join', { gameId: room.gameId, playerName: 'Dee', playerToken: token() })
      assert.strictEqual(await full, 'Game has already started')

      const cyBack = await join(room.gameId, 'Cy', tokenCy)
      assert.strictEqual(cyBack.joined.playerId, seats[2].joined.playerId)
      assert.strictEqual(cyBack.joined.resumed, true)
      assert.strictEqual(cyBack.state.players.length, 3)
      assert.strictEqual(cyBack.state.isGameStarted, true)

      const lobby = await createRoom()
      await join(lobby.gameId, 'Ava', token())
      await join(lobby.gameId, 'Ben', token())
      await join(lobby.gameId, 'Cy', token())
      const overflow = await connect()
      const overflowErr = waitFor<string>(overflow, 'error')
      overflow.emit('join', { gameId: lobby.gameId, playerName: 'Dee', playerToken: token() })
      assert.strictEqual(await overflowErr, 'Game is full')
    })

    await stage('dev TV reclaim keeps DEV without wiping', async () => {
      process.env.BRACKET_RANDOM_ROOMS = '0'
      try {
        const host = await connect()
        const createdP = waitFor<{ gameId: string, hostToken: string }>(host, 'game_created')
        host.emit('create_game')
        const created = await createdP
        assert.strictEqual(created.gameId, 'DEV')
        const ava = await join('DEV', 'Ava', token())

        const busy = await connect()
        const denied = waitFor<string>(busy, 'error')
        busy.emit('create_game')
        assert.strictEqual(await denied, 'Host TV is already connected')

        const gone = waitFor<PublicGameState>(ava.phone, 'game_state')
        host.disconnect()
        await gone

        const tv = await connect()
        const replayP = new Promise<{ gameId: string, hostToken: string, players: PublicGameState['players'] }>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout waiting for DEV reclaim')), 3000)
          tv.once('game_created', (msg: { gameId: string, hostToken: string }) => {
            tv.once('game_state', (state: PublicGameState) => {
              clearTimeout(timer)
              resolve({ gameId: msg.gameId, hostToken: msg.hostToken, players: state.players })
            })
          })
        })
        tv.emit('create_game')
        const reclaimed = await replayP
        assert.strictEqual(reclaimed.gameId, 'DEV')
        assert.strictEqual(reclaimed.hostToken, created.hostToken)
        assert.strictEqual(reclaimed.players.length, 1)
        assert.strictEqual(reclaimed.players[0].id, ava.joined.playerId)
        assert.strictEqual(reclaimed.players[0].connected, true)
      } finally {
        process.env.BRACKET_RANDOM_ROOMS = '1'
      }
    })

    await stage('coin timeout places the same winner', async () => {
      process.env.COIN_TIMEOUT_MS = '200'
      const room = await createRoom()
      const ava = await join(room.gameId, 'Ava', token())
      const ben = await join(room.gameId, 'Ben', token())
      const bracketReady = waitForMatch<PublicGameState>(room.host, 'game_state', (state) => Boolean(state.bracket))
      ava.phone.emit('set_bracket', { gameId: room.gameId, code: 'demo' })
      await bracketReady
      const started = waitForMatch<PublicGameState>(room.host, 'game_state', (state) => state.phase === 'voting')
      ava.phone.emit('start_game', { gameId: room.gameId })
      await started
      ava.phone.emit('vote', { gameId: room.gameId, choice: 0 })
      const coinP = waitForMatch<PublicGameState>(room.host, 'game_state', (state) => state.phase === 'coin')
      ben.phone.emit('vote', { gameId: room.gameId, choice: 1 })
      const coinState = await coinP
      const winnerId = coinState.coin?.winner.id
      const resolved = await waitForMatch<PublicGameState>(
        room.host,
        'game_state',
        (state) => state.phase === 'voting' && state.currentMatchupIndex === 1,
        2000
      )
      assert.strictEqual(resolved.matchups[0].winner?.id, winnerId)
      assert.strictEqual(resolved.coin, null)
      await delay(250)
      assert.strictEqual(resolved.currentMatchupIndex, 1)
    })

    console.log('reconnect.sim.test.ts: ok')
  } finally {
    process.env.COIN_TIMEOUT_MS = '0'
    game.shutdown()
    for (const socket of opened) socket.disconnect()
    await new Promise<void>((resolve) => io.close(() => resolve()))
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
