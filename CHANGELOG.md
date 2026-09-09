# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-09-09

### Added
- Host TV is a full-viewport three.js night (React Three Fiber): lobby with join code + QR plane, matchup plaques, vote tally bars, cinematic gold coin, champion
- Pure game engine (`backend/src/engine.ts`) shared by sockets and sims
- Simulation harness (`npm run sim`) covering 4-16 players, byes, ties, disconnect/reconnect, late join, room full, host start, full tournament
- House `showcase` bracket (8 contestants, no SQLite) so a night can run on a fresh box
- Stable player ids, disconnect flags, and clearer join errors (full, late join, unknown room)

### Changed
- Default `MAX_PLAYERS` is 16 (still overridable)
- Ties still pick a winner on the server and always send `wasTie` + `tallies` so the TV can play tally drama then the three.js coin
- Bracket builder pads non-power-of-two fields to the next power of two; first-round byes auto-advance
- `isGameOver` is set on the server when the final matchup resolves

### Cutover
- Live rooms stay in-memory. Deploy or restart drops in-progress nights. Start a new room after upgrade.
- Vote identity moved from Socket.IO id to a stable player id. Additive fields: `phase`, `connected`, `socketId`, `bye`, `tallies`, `joined`. Old in-flight clients would desync, but they die with the process anyway.

## [0.1.0] - 2026-08-12

### Added
- Premium host TV theme (stadium backdrop, neon bracket paths, mobile navy/gold unify)
- Cinematic coin toss on ties: contestant photo faces, thick gold rim, upward parabolic toss + confetti
- GitHub Actions CI (lint/typecheck/test/build) and multi-arch Docker Hub publish (`helvio/bracket-night`)
- MIT license, Dependabot, API rate limits / optional `API_SECRET`, SSRF guards

### Changed
- Host UI fits the viewport (no vertical scrollbar); round labels aligned (R16 / QF / SF / Finals)
- Coin toss is canon-only (auto on ties); Demo Toss control removed
- Join codes hardened to 8-char hex; README points at GitHub

### Fixed
- Production Socket.IO CORS; safer image URL fetching
- Host TV: top breathing room for logo + round labels; true horizontal centering
- Bracket connectors use square orthogonal elbows
- Tie to coin toss: server emits `wasTie` so the host cinematic always fires (client vote-ref race)

[0.2.0]: https://github.com/helv-io/bracket-night/releases/tag/v0.2.0
[0.1.0]: https://github.com/helv-io/bracket-night/releases/tag/v0.1.0
