# AGENTS.md

Guidelines for changes to Bracket Night. Applies to code, UI text, docs and releases.

## Style

- Plain, short, direct. No marketing words, no em dashes.
- The README is for people who run or play it. Internals go in the code.
- CHANGELOG lines are user-visible changes, one line each.
- Small commits with a message body. One concern per commit.
- `npm run typecheck`, `npm test`, `npm run lint` and `npm run build` pass for every commit.

## Publishing

- The Docker image is built once per architecture, each on a runner of its own kind. Nothing runs under emulation.
- `latest` follows the default branch only. A version tag adds its own version tags.

## Rules and what enforces them

A rule that nothing enforces is a wish. Before you push, run `.agent-checks/bin/agent-checks local` (the shared [`agent-checks`](https://github.com/helv-io/agent-checks) repo) and the npm scripts above.

| Rule | Enforced by |
|---|---|
| Every commit is Helvio Pedreschi <helvio88@gmail.com>, nobody else | git refuses to guess an identity on the box; `identity` check on every push |
| No em dashes, no marketing words | `voice` check on added lines, whole tree weekly |
| CHANGELOG moves with every user-facing change; otherwise `Docs: skip <reason>` in a commit message | `docs` check |
| Typecheck, tests, lint and build pass | `CI` workflow on every branch push |
| The Docker image builds for both architectures before it is published | `Docker` workflow builds both on every branch push, publishes only from the default branch and tags |
| Workflow files are valid | `actionlint` inside the `agent-checks` job |
| Work on a branch. Never push to the default branch, never open a pull request unless asked | branch protection on the default branch; Helvio or Rook merges |
| When a project is going for distribution, offer Helvio to protect master | judgment (Rook offers it) |
| Short, human tone in public drafts; what to build next | judgment, not enforceable |
