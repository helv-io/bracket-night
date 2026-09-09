# Bracket Night

Bracket Night is a Jackbox-class party game. The host TV is a three.js night (React Three Fiber). Phones join by QR, lock a name, and vote. Stack: TypeScript, Express + Socket.IO, Next.js pages router, three.js on the host.

## Features

- **Host TV (three.js)**: Full-viewport lobby (join code + QR plane), matchup plaques, vote tally drama, cinematic gold coin on ties, champion.
- **Join flow**: Scan or type the 8-char hex code, pick a name, sit in lobby, vote on the phone.
- **Voting + bracket**: Winners advance through the field. Server sets `isGameOver` when one champion remains.
- **Tie resolution**: Server assigns a winner and emits `wasTie` + `tallies`. The TV plays tally bars, then the three.js coin (CSS coin is prior art; host path is WebGL).
- **Byes**: Fields that are not a power of two pad to the next power of two. Real-vs-real pairs first, then real-vs-empty byes. Byes auto-advance when they become current. Template create UI still ships 16 contestants. The engine accepts 2-16 (house `showcase` is 8).
- **Players**: Up to `MAX_PLAYERS` (default 16). Late join after start is rejected with a clear error. Reconnect by the same name keeps the stable player id and any locked vote. Disconnect marks the seat; the night still waits for that vote.
- **House showcase**: Game master can load code `showcase` (also listed under public brackets). No SQLite required.
- **Templates**: `/new` still writes 16-contestant brackets to SQLite.
- **Docker**: See `Dockerfile`.

## Architecture notes

| Concern | Storage |
| --- | --- |
| Bracket templates (codes, contestants, images) | SQLite (`DB_PATH`) |
| Live game rooms / votes / players | **In-process `Map` in `backend/src/game.ts`** (logic in `backend/src/engine.ts`) |
| House showcase field | In-memory (`showcase` code) |

Live games are **not** persisted. Restarting the server wipes active rooms. Multi-instance / Redis is intentionally out of scope. Run a single process.

**Cutover (0.2.0):** rooms are still in-memory, so a deploy drops in-progress nights. Protocol adds `phase`, `joined`, stable `player.id`, `connected`, `socketId`, `matchup_advanced.wasTie/bye/tallies`. Votes key off the stable player id, not the Socket.IO id. Start a new room after upgrade. Do not expect a live night to survive the bounce.

Join codes are 8-character hex strings (dev uses `DEV`). Short guessable codes were replaced without changing the QR/`?game=` URL contract.

## Setup

### Prerequisites

- Node.js 22+ (or current LTS)
- Docker (optional)

### Install & run

```bash
git clone https://github.com/helv-io/bracket-night
cd bracket-night
cp .env.example backend/.env   # edit as needed
npm install
npm run dev
```

- Frontend (Next.js): http://localhost:3000  
- Backend (Express / Socket.IO): http://localhost:3001  

### Folder structure

```
bracket-night/
├── backend/
│   └── src/
│       ├── ai.ts
│       ├── config.ts
│       ├── db.ts
│       ├── engine.ts        # pure night logic (votes, byes, ties)
│       ├── game.ts          # Socket.IO adapter + in-memory rooms
│       ├── image.ts
│       ├── security.ts      # topic limits, API secret, SSRF, CORS helpers
│       ├── server.ts
│       ├── showcase.ts      # house field, no SQLite
│       ├── sim/run.ts       # scripted path coverage
│       └── types.ts
├── frontend/
│   ├── components/          # host/ is the three.js TV
│   ├── lib/
│   ├── pages/               # Next.js pages router
│   ├── public/
│   ├── styles/
│   └── next.config.ts
├── .env.example
├── Dockerfile
├── package.json
└── README.md
```

### Docker

Published images (same `helvio/*` convention as other helv-io repos):

```bash
# main → :latest
docker pull helvio/bracket-night:latest

# restore/thick-gold-coin → branch slug (pre-merge test)
docker pull helvio/bracket-night:restore-thick-gold-coin

docker run -p 3000:3000 --env-file backend/.env helvio/bracket-night:restore-thick-gold-coin
```

Local build:

```bash
docker build -t bracket-night .
docker run -p 3000:3000 --env-file backend/.env bracket-night
```

CI (`.github/workflows/docker.yml`, reelgrab pattern) publishes multi-arch (`linux/amd64`, `linux/arm64`) to Docker Hub on push to `main` / `restore/thick-gold-coin`, tags `v*`, and `workflow_dispatch`. PRs build without push. Tags: `:latest` (main only), branch slug, `sha-*`, semver. Requires Variable/Secret `DOCKERHUB_USERNAME` + Secret `DOCKERHUB_TOKEN`.

## Configuration

See [`.env.example`](.env.example) for the full list. Important knobs:

- **`OPENAI_API_KEY` / `OPENAI_URL` / `OPENAI_MODEL`**: AI contestant generation. In production, `/api/ai/:topic` fails closed with HTTP 503 if these are missing.
- **`API_SECRET` or `BRACKET_API_SECRET`**: Optional shared secret for `/api/ai/*` and `/api/image/*`. If set, send `X-API-Secret` (or `?api_secret=`). Rate limits always apply; setting a secret is recommended for internet-exposed deploys. When using the `/new` UI with a secret, also set `NEXT_PUBLIC_API_SECRET` at frontend build time.
- **`CORS_ORIGIN` or `FRONTEND_ORIGIN`**: Comma-separated Socket.IO CORS allowlist. Dev defaults to `http://localhost:3000`; production same-origin leaves this unset.
- **`SEARXNG_HOST` / `IMGPROXY_*`**: Image search and resize proxy used when creating brackets.
- **`DB_PATH` / `DATA_PATH`**: SQLite DB and downloaded images.

### Expensive HTTP APIs

`GET /api/ai/:topic` and `GET /api/image/:topic` are rate-limited, topic-length limited (max 100 chars), and optionally secret-gated. Client-supplied `image_url` values on bracket create are SSRF-checked (http(s) only; private/link-local/metadata IPs blocked; configured imgproxy host allowed).

## Usage

- **Main page (`/`)**: Host screen with QR code for the live join code.
- **Join (`/join?game=...`)**: Player join / vote UI.
- **New (`/new`)**: Create a reusable bracket template.

## Development

- TypeScript: 2-space indentation, no semicolons.
- `npm test`: security + engine unit tests + simulation harness.
- `npm run sim`: simulation only (writes `SIM-REPORT.md`).
- `npm run build`: build frontend (static export) + backend bundle.
- `npm run lint`: Next.js ESLint.

Host TV needs WebGL. Phones stay DOM (vote + lobby). The old 2D bracket canvas is not the host path anymore.

### Simulation

`npm run sim` drives the engine with scripted players. It does not open Socket.IO or a browser. Covered paths: 4 and 16 player full nights, 6- and 12-contestant byes, ties (`wasTie`), disconnect/reconnect, late join reject, room full, host start gates, house showcase, single champion. Visual three.js and phone chrome are not in the harness. See `SIM-REPORT.md` after a run.

## License

MIT — see [LICENSE](LICENSE).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=helv-io/bracket-night&type=Date&theme=dark)](https://www.star-history.com/#helv-io/bracket-night&Date)
