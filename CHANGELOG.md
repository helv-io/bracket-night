# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-09-09

Rebuild from scratch. New product surface, not a wrap of the 0.1.0 Next.js TV.

### Added
- Pure `engine/` room + tournament rules: 2-16 contestants, byes to the next power of two, stable player ids, disconnect/reconnect by name, late-join reject, host resolve
- three.js host TV (Vite + R3F): lobby, matchup, vote meters, tally, cinematic coin, full tournament tree, champion
- House showcase photos (`frontend/public/showcase/01.jpg` to `08.jpg`) on lobby cards, matchup cards, coin faces, and the bracket board
- New player join/vote UI and `/new` studio on the same Vite app
- House `showcase` field (8 contestants) so a night can start without SQLite
- Scripted harness (`npm run sim`) with engine cases and live Socket.IO bots; writes `SIM-REPORT.md`
- `/api/health` and 2-16 contestants on `POST /api/create-bracket`

### Changed
- Default `MAX_PLAYERS` is 16
- Host is the TV socket, not the first phone
- Votes key off a stable player id, not the Socket.IO id
- Frontend toolchain is Vite. Next.js pages router is gone
- Version **0.2.0** (semver-ready for `helvio/bracket-night:latest` plus `v0.2.0`)

### Removed
- `backend/src/game.ts` as the product core (tangled, 16-only, no byes)
- Old host/player/studio Next pages and CSS bracket DOM

### Fixed
- Coin toss spins around X (cap-to-cap) with a parabolic flight that settles on the winner. A Y-spin on a Y-aligned cylinder never flipped the faces.

### Cutover
- Live rooms stay in-memory. Restart or deploy drops in-progress nights.
- SQLite templates still load by code.

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
