# Bracket Night

A Jackbox-style tournament night. The TV is a three.js arena. Phones join, vote, and watch one champion take the room.

This tree is a **from-scratch rebuild** (v0.2.0). It is not a polish of the old Next.js pages or the old TV DOM. Closed PR #129 wrapped three.js around that stack and is not the product path.

## What you can demo

1. Open `/` on a desktop. The host TV is a full-viewport three.js night: lobby (join code + QR plane + player orbs), matchup cards, vote meters, tally, cinematic coin, champion.
2. Phones open `/join?game=DEV` in development (or the code on the TV).
3. On the TV, load **showcase** (house field, 8 contestants, no SQLite) and start.
4. Vote through the night. A tie plays a gold three.js coin, then the winner advances.
5. One champion.

`/new` is the template studio. It still writes SQLite fields. Live rooms never touch that store.

## Borrowed vs new

| Piece | Status |
| --- | --- |
| Tournament / room engine | **New.** Pure TypeScript in `engine/`. No Socket.IO. |
| Host TV + player + studio UI | **New.** Vite + React + three.js / R3F. Old Next pages removed. |
| Socket.IO protocol | **New adapter** in `backend/src/realtime.ts` over the engine. |
| `backend/src/game.ts` | **Not reused.** Hard-coded 16, socket ids as player ids, no byes, `isGameOver` never set. |
| SQLite templates, AI, image search, SSRF, rate limits | **Borrowed.** Still solid and not tied to the old TV. |
| Live room storage | Same rule: in-process `Map`. Restart drops games. |

## Simulation

```bash
npm test          # engine units, security units, then the harness
npm run sim       # harness only; writes SIM-REPORT.md
npm run rehearsal # bots vs a running `npm run dev` TV (DEV)
```

The harness covers 4-16 players, byes (6 and 12 contestant fields), ties to coin, disconnect/reconnect, late-join reject, room full, host start/resolve, showcase, and a live Socket.IO night to a single champion.

Labeled stubs are in `SIM-REPORT.md` (pixels, phone chrome, SQLite codes besides showcase, persisted rooms).

## Cutover

Live rooms are **in-memory**. Deploying `helvio/bracket-night:latest` or restarting the process **drops every in-progress night**. Start a new room after the new binary is up. Templates in SQLite survive.

## Stack

- Engine: TypeScript, no I/O
- Server: Express + Socket.IO
- TV: three.js via React Three Fiber + drei
- Player / studio: React (DOM). Jackbox split, not a stub of the TV.
- Build: Vite (frontend) + esbuild (backend)

## Setup

```bash
git clone https://github.com/helv-io/bracket-night
cd bracket-night
cp .env.example backend/.env
npm install
npm run dev
```

- TV / Vite: http://localhost:3000
- API / Socket.IO: http://localhost:3001
- Dev join code: `DEV` (set `NIGHT_DEV_CODE=1` with `NODE_ENV=development`)

### Folders

```
bracket-night/
├── engine/                 # pure night rules
├── backend/src/
│   ├── app.ts              # HTTP + static
│   ├── realtime.ts         # Socket.IO adapter
│   ├── db.ts image.ts ai.ts security.ts
│   └── server.ts
├── frontend/src/
│   ├── tv/                 # three.js host
│   ├── player/
│   └── studio/
├── sims/                   # bots + report
└── Dockerfile
```

### Docker

```bash
docker pull helvio/bracket-night:latest
docker run -p 3000:3000 --env-file backend/.env helvio/bracket-night:latest
```

CI (`.github/workflows/docker.yml`) still publishes multi-arch images to Docker Hub on push to `main`, tags `v*`, and `workflow_dispatch`. Tags: `:latest` (main only), semver, `sha-*`. Needs `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN`.

## Configuration

See [`.env.example`](.env.example).

- `MAX_PLAYERS` defaults to 16 (engine cap). Typical night is 4-16.
- `OPENAI_*` for `/api/ai/:topic` (fails closed in production if missing).
- `API_SECRET` / `VITE_API_SECRET` for expensive AI and image routes.
- `CORS_ORIGIN` / `FRONTEND_ORIGIN` for Socket.IO when the TV is not same-origin.

## Development

TypeScript: 2-space indentation, no semicolons.

- `npm test` engine + security + sims
- `npm run build` Vite static + backend bundle
- `npm run lint` frontend ESLint

## License

MIT. See [LICENSE](LICENSE).
