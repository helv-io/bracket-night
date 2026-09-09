# Bracket Night simulation report

Generated: 2026-09-09T15:36:06.816Z
Result: **18/18 passed**

## Real (this harness)

| Status | Layer | Id | Title | ms |
| --- | --- | --- | --- | ---: |
| PASS | engine | `engine-4p-8c` | 4 players / 8 contestants to a single champion | 2 |
| PASS | engine | `engine-16p-16c` | 16 players / 16 contestants full night | 1 |
| PASS | engine | `engine-byes-6` | 6 contestants pad to 8 with real-vs-empty byes | 0 |
| PASS | engine | `engine-byes-12` | 12 contestants pad to 16 with byes | 0 |
| PASS | engine | `engine-tie-coin` | Even split emits wasTie and coin phase | 1 |
| PASS | engine | `engine-disconnect-reconnect` | Disconnect keeps player id; reconnect by name; vote still locks | 0 |
| PASS | engine | `engine-late-join` | Late join rejected after start | 0 |
| PASS | engine | `engine-room-full` | Room full at 16 | 0 |
| PASS | engine | `engine-host-no-field` | Host cannot start without a field | 0 |
| PASS | engine | `engine-host-resolve` | Host resolve_now skips disconnected voters | 0 |
| PASS | engine | `engine-showcase` | House showcase field (8) to champion | 0 |
| PASS | socket | `socket-4p-showcase` | Live Socket.IO: 4 bots, showcase, champion | 110 |
| PASS | socket | `socket-unknown-room` | Live Socket.IO: unknown room is a clear reject | 8 |
| PASS | socket | `socket-late-join` | Live Socket.IO: late join rejected after start | 16 |
| PASS | socket | `socket-reconnect` | Live Socket.IO: disconnect and reconnect by name | 61 |
| PASS | socket | `socket-tie-coin` | Live Socket.IO: even split -> coin phase | 23 |
| PASS | socket | `socket-host-resolve` | Live Socket.IO: host resolve_now after disconnects | 66 |
| PASS | socket | `socket-16p` | Live Socket.IO: 16 bots / 16 contestants to champion | 408 |

## Labeled stubs / out of band

| Id | Title | Note |
| --- | --- | --- |
| `pixels` | three.js pixels (TV canvas, coin mesh, camera dollies) | Covered by the host client, not this harness. Run the TV at / to see them. |
| `phone-chrome` | Phone layout / wake lock / QR camera | Player UI is real; this harness drives the protocol, not Safari chrome. |
| `sqlite-templates` | SQLite template codes besides showcase | Real path via set_field code -> getBracketByCode. Harness uses showcase + inline fields. |
| `persist-rooms` | Persisted live rooms | Still in-memory. Restart drops every night. Documented cutover, not a stub of the rule. |

## Failures

None.

## Cutover

Live rooms are an in-process Map. Deploy or restart drops in-progress nights.
Start a new room after the new binary is up.
