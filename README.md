# Bracket Night

Bracket Night is a Jackbox-style party game. Players join by scanning a QR code and vote on contestants in a classic tournament bracket. Stack: TypeScript, Express + Socket.IO backend, Next.js (pages router) frontend.

## Features

- **Bracket Setup**: Create a bracket with a title, subtitle, and 16 contestants, each with a picture.
- **Voting System**: Players vote; winners advance through quarters, semis, and finals.
- **Tie Resolution**: Ties trigger a cinematic coin toss on the host TV.
- **Player Management**: Up to `MAX_PLAYERS` (default 10) join via QR code.
- **Bracket Templates**: First player can enter a bracket code to load contestants/images from SQLite.
- **Mobile Friendly**: `/new` for creating brackets; mobiles hitting `/` redirect there.
- **Docker Support**: Multi-arch images on Docker Hub.

## Releases

Versioning is **semver via git tags** (`vX.Y.Z`) on `main` — see [CHANGELOG.md](CHANGELOG.md) and [Releases](https://github.com/helv-io/bracket-night/releases).

```bash
docker pull helvio/bracket-night:latest   # tip of main
docker pull helvio/bracket-night:0.1.0    # pinned semver
```

## Architecture notes

| Concern | Storage |
| --- | --- |
| Bracket templates (codes, contestants, images) | SQLite (`DB_PATH`) |
| Live game rooms / votes / players | **In-process `Map` in `backend/src/game.ts`** |

Live games are **not** persisted. Restarting the server wipes active rooms. Multi-instance / Redis is intentionally out of scope for now — run a single process.

Join codes are 8-character hex strings (dev uses `DEV`). Short guessable codes were replaced without changing the QR/`?game=` URL contract.

## Setup

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
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
├── frontend/
│   ├── components/
│   ├── pages/
│   └── public/
├── .env.example
├── Dockerfile
├── package.json
└── README.md
```

### Docker

```bash
docker pull helvio/bracket-night:latest
docker run -p 3000:3000 --env-file backend/.env helvio/bracket-night:latest
```

Local build:

```bash
docker build -t bracket-night .
docker run -p 3000:3000 --env-file backend/.env bracket-night
```

CI (`.github/workflows/docker.yml`) publishes multi-arch (`linux/amd64`, `linux/arm64`) to Docker Hub on push to `main`, tags `v*`, and `workflow_dispatch`. PRs build without push. Tags: `:latest`, semver (`0.1.0`, `0.1`, `0`), `sha-*`. Requires Variable/Secret `DOCKERHUB_USERNAME` + Secret `DOCKERHUB_TOKEN`.

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
- `npm test` — backend security unit tests.
- `npm run build` — build frontend (static export) + backend bundle.
- `npm run lint` — Next.js ESLint.

## License

MIT — see [LICENSE](LICENSE).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=helv-io/bracket-night&type=Date&theme=dark)](https://www.star-history.com/#helv-io/bracket-night&Date)
