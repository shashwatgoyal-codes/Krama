# Krama — working notes

A personal planner: tasks that recur on their own, sticky notes, a calendar,
saved links, and a scoring system that rewards effort rather than outcomes.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Plain CSS with custom properties — tokens live in `app/globals.css` |
| Database | Neon Postgres |
| ORM | Prisma |
| Auth | Own session cookies, Argon2id password hashing — no auth library |
| Mutations | Server Actions, validated with `zod` |
| Tests | Vitest for units, Playwright for end-to-end |

No component library, no animation library, no chart library. Everything in
`components/` is hand-written against the tokens.

## Branches and environments

```
dev    →  qa    →  stage  →  prod
```

- **dev** — day-to-day work. Branch from here, merge back here.
- **qa** — feature-complete, being tested. Automated tests must pass.
- **stage** — production mirror. Final manual check before release.
- **prod** — live. Only ever fast-forwarded from stage.

Each environment points at **its own Neon branch**, so a migration in dev
cannot touch production data. Configure per-environment values in the host's
environment settings; locally use `.env.local` (see `.env.example`).

## Rules that aren't obvious

- **Every route under `/app` and every server action requires a session.**
  There is no unauthenticated data path. Authorisation is enforced in the
  repository layer: every query function takes `userId` as a required argument.
- **`point_ledger` is append-only.** A database trigger rejects `UPDATE` and
  `DELETE`. Scores are always recomputed from it, never edited.
- **Points are awarded in one server-side transaction**, never by the client.
  Neon's pooled endpoint breaks Prisma interactive transactions, so the award
  is a plpgsql function called with `$queryRaw`.
- **Never render user text as HTML.** Notes, tasks and links are plain text.
- **No data import.** Export only — a hand-edited file could forge the ledger.
- The theme is three-state: bare `:root` is light, `prefers-color-scheme`
  handles system dark, `[data-theme]` beats both. Set before first paint by an
  inline script in `app/layout.tsx`.

## Commands

```
npm run dev          # local development
npm run build        # production build
npm run test         # unit tests
npm run test:e2e     # end-to-end tests
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
