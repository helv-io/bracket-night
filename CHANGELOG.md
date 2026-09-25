# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Stable player identity and host key so a phone or the TV can drop and resume the same night (lobby, vote, or coin)
- Built-in `DEMO` bracket (Mountain GOATs) for a room that has no saved template
- Socket.IO reconnect simulation covering disconnect mid-lobby, mid-vote, mid-coin, late rejoin, and host reattach
- Lobby / host tips for the two-phone DEMO coin path (even count · opposite votes)
- Stronger TV coin spectacle (larger disk, stadium rays, impact flash, clearer tie kicker) and a clearer phone “watch the big screen” notice
- Host TV “Host TV” brand chip during the toss; champion curtain + lobby ready-up polish

### Changed
- Ties are a server phase. The bracket advances when the host finishes the coin cinematic, or when the coin timeout fires
- **Coin flip is camera-first**: ~5.8s spin, ~4 / 4.5 readable revolutions (was 10 in 3.4s), larger disk during the flip (~620px), shallower arc so the gold coin stays center-frame, full-bleed host takeover (`bn-coin-live`) while phones stay on the watch-TV notice


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
- Tie → coin toss: server emits `wasTie` so the host cinematic always fires (client vote-ref race)

[0.1.0]: https://github.com/helv-io/bracket-night/releases/tag/v0.1.0
