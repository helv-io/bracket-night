# Bracket Night

Bracket Night is a Jackbox-style party game. Players join by scanning a QR code and vote on contestants in a classic tournament bracket. Stack: TypeScript, Express + Socket.IO backend, Next.js (pages router) frontend.

## Features

- **Bracket Setup**: Create a bracket with a title, subtitle, and 16 contestants, each with a picture.
- **Voting System**: Players vote; winners advance through quarters, semis, and finals.
- **Tie Resolution**: Ties open a server-owned coin toss on the host TV. The bracket advances when the toss finishes (or when the server timeout places the already-chosen winner).
- **Player Management**: Up to `MAX_PLAYERS` (default 10) join via QR code. Each phone keeps a stable player id (not the socket id) in local storage, so a refresh, a dropped connection, or reopening `/join?game=...` resumes the same seat in the lobby, a vote, or a coin toss. The host TV stores a host key and reattaches to the same room.
- **Bracket Templates**: First player can enter a bracket code to load contestants/images from SQLite.
- **Mobile Friendly**: `/new` for creating brackets; mobiles hitting `/` redirect there.
- **Docker Support**: See `Dockerfile`.

## Architecture notes

| Concern | Storage |
| --- | --- |
| Bracket templates (codes, contestants, images) | SQLite (`DB_PATH`) |
| Live game rooms / votes / players | **In-process `Map` in `backend/src/game.ts`** |

Live games are **not** persisted. Restarting the server wipes active rooms. Multi-instance / Redis is intentionally out of scope for now — run a single process.

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
│       ├── game.ts          # in-memory live games
│       ├── image.ts
│       ├── security.ts      # topic limits, API secret, SSRF, CORS helpers
│       ├── server.ts
│       └── types.ts
├── frontend/
│   ├── components/
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
- **Join (`/join?game=...`)**: Player join / vote UI. Game masters can load the built-in `DEMO` bracket (Mountain GOATs) with no database setup.
- **New (`/new`)**: Create a reusable bracket template.


### Screen-recording the coin (2 phones + DEMO)

1. `npm run dev`, open `/` on a desktop (the host TV).
2. Open the join link on **two** phones (or two mobile browser profiles) **before** start. First phone is game master.
3. Tap **Load Mountain GOATs**, wait until both seats show in the lobby, then **Everyone ready — start**.
4. On matchup 1, phones vote **opposite** sides. Even player counts can tie; opposite votes with two phones always open the coin.
5. **Frame the host TV full-bleed** (phones stay in hand — they only show “Watch the big screen”). The gold coin should spin for ~6 seconds with contestant faces clearly flipping; then it lands and celebrates.
6. Let it land, or wait for the server timeout (`COIN_TIMEOUT_MS`, default 14s). Optional reconnect checks while the coin is up: refresh a phone, reload the TV. The same toss (`startedAt` / winner side) comes back; the bracket does not advance early.

Recording tip: frame the TV full-screen; the phone only shows a “watch the big screen” notice during the toss.

### Reconnects

Live rooms stay in memory for the process lifetime. Within that lifetime:

- A phone's identity is a random token stored at `localStorage['bn.player.<gameId>']`. The server mints a player id from that token. Socket ids are only the current connection.
- The host TV stores `localStorage['bn.host.session']`. Reloading the TV emits `host_attach` and keeps the bracket, votes, and coin.
- Disconnecting does not remove a seat or a vote. A new person cannot take a disconnected name, and a new token cannot join after the night has started.
- `npm test` runs a Socket.IO simulation of mid-lobby, mid-vote, mid-coin, and late reconnect, plus a host reattach.

## Development

- TypeScript: 2-space indentation, no semicolons.
- `npm test` — backend security unit tests.
- `npm run build` — build frontend (static export) + backend bundle.
- `npm run lint` — Next.js ESLint.

## License

MIT — see [LICENSE](LICENSE).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=helv-io/bracket-night&type=Date&theme=dark)](https://www.star-history.com/#helv-io/bracket-night&Date)
