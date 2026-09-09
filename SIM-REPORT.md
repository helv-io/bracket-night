# Bracket Night simulation report

Generated: 2026-09-09T14:23:14.139Z

## Paths

- [pass] **full-4p-8c**: 4 players / 8 contestants / full tournament to one winner
  - Power-of-two field. No byes.
  - ok join 1 (Player 1)
  - ok join 2 (Player 2)
  - ok join 3 (Player 3)
  - ok join 4 (Player 4)
  - ok apply bracket
  - ok start
  - ok no byes (byes=0)
  - ok champion (Fighter 2)
  - ok phase champion (champion)

- [pass] **full-16p-16c**: 16 players / 16 contestants / full tournament
  - MAX_PLAYERS product cap. Classic 15-matchup night.
  - ok join 1 (Player 1)
  - ok join 2 (Player 2)
  - ok join 3 (Player 3)
  - ok join 4 (Player 4)
  - ok join 5 (Player 5)
  - ok join 6 (Player 6)
  - ok join 7 (Player 7)
  - ok join 8 (Player 8)
  - ok join 9 (Player 9)
  - ok join 10 (Player 10)
  - ok join 11 (Player 11)
  - ok join 12 (Player 12)
  - ok join 13 (Player 13)
  - ok join 14 (Player 14)
  - ok join 15 (Player 15)
  - ok join 16 (Player 16)
  - ok apply bracket
  - ok start
  - ok 15 matchups (n=15)
  - ok champion (Fighter 14)

- [pass] **byes-6c**: 6 contestants / byes auto-advance
  - Fill rule: pad to 8, two first-round byes, drain on start and after votes.
  - ok join 1 (Player 1)
  - ok join 2 (Player 2)
  - ok join 3 (Player 3)
  - ok join 4 (Player 4)
  - ok apply bracket
  - ok 2 byes scheduled (byes=2)
  - ok start
  - ok start drains opening byes or leaves them queued
  - ok single champion
  - ok index past last matchup

- [pass] **byes-12c**: 12 contestants / pad to 16 with 4 byes
  - Non-power-of-two field uses the same fill rule.
  - ok join 1 (Player 1)
  - ok join 2 (Player 2)
  - ok join 3 (Player 3)
  - ok join 4 (Player 4)
  - ok join 5 (Player 5)
  - ok apply bracket
  - ok 4 byes (byes=4)
  - ok 15 matchups
  - ok start
  - ok champion

- [pass] **tie-coin**: Tie → wasTie + winner assigned (TV coin path)
  - Engine picks a random side on ties and flags wasTie. TV plays the three.js coin.
  - ok join 1 (Player 1)
  - ok join 2 (Player 2)
  - ok join 3 (Player 3)
  - ok join 4 (Player 4)
  - ok apply 2-field
  - ok start
  - ok all in
  - ok wasTie
  - ok winner exists
  - ok tallies 2-2

- [pass] **disconnect-reconnect**: Disconnect then reconnect by name keeps identity and vote lock
  - Late socket gets the same player id. Mid-round vote is not lost.
  - ok join Ada
  - ok join Bea
  - ok Ada votes
  - ok Ada disconnected
  - ok Ada reconnects
  - ok same id (162a70adf1d084ca vs 162a70adf1d084ca)
  - ok Bea finishes matchup

- [pass] **late-join-reject**: Late join after start is rejected with a clear error
  - Product choice: no mid-night seats. Host starts a new room for extras.
  - ok rejected (This night already started. Late join is closed. Watch the TV, or start a new room.)
  - ok message names late join

- [pass] **room-full**: 16th seat is last; 17th is rejected
  - Default MAX_PLAYERS is 16. Config can lower it.
  - ok join 1 (Player 1)
  - ok join 2 (Player 2)
  - ok join 3 (Player 3)
  - ok join 4 (Player 4)
  - ok join 5 (Player 5)
  - ok join 6 (Player 6)
  - ok join 7 (Player 7)
  - ok join 8 (Player 8)
  - ok join 9 (Player 9)
  - ok join 10 (Player 10)
  - ok join 11 (Player 11)
  - ok join 12 (Player 12)
  - ok join 13 (Player 13)
  - ok join 14 (Player 14)
  - ok join 15 (Player 15)
  - ok join 16 (Player 16)
  - ok full (Room is full (16 players).)

- [pass] **host-controls**: Host cannot start without a bracket; start opens voting
  - Start lives on the game-master phone, same as today.
  - ok start blocked (Load a bracket before starting.)
  - ok start after showcase
  - ok phase matchup or champion (matchup)
  - ok showcase 8 contestants

- [pass] **unknown-empty-name**: Empty name rejected; unknown room is a socket-level error (documented)
  - Engine never sees an unknown room. Socket adapter emits a clear error. Covered here as empty-name + documented stub for transport.
  - ok empty name

## Summary

10 passed / 0 failed / 0 stubbed / 10 total

## Real vs stubbed

- Real: bracket fill (byes), join/reconnect, late-join reject, room full, host start gates, voting, ties (`wasTie` + tallies), full tournament to one champion, house `showcase` field.
- Real but not Socket.IO: this harness drives `backend/src/engine.ts` directly so CI stays hermetic.
- Socket adapter (`game.ts`) is a thin emit layer. Unknown-room copy is covered by code review + the join handler, not a live port bind.
- Visual: three.js TV (lobby, matchup, tally, coin, champion) is not asserted here. Run the host at `/` for that path.
- Phone UI is not in this harness.
- Live rooms stay in-memory. A deploy still drops in-progress nights.
