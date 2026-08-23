<div align="center">

<img src="app/icon.png" width="76" alt="">

# Krama

**क्रम** — *step, sequence, order.*

A personal planner: notes, tasks, a calendar and saved links, joined end to end,
with points for the effort rather than the outcome.

</div>

---

## What it is

Notes, calendars and task lists exist in a hundred apps. What makes this one app
is the path between them:

```
note / saved link  →  task  →  calendar block  →  points
     capture           commit      schedule       record
```

A note has a *make this a task* action, so a thought becomes a commitment without
being retyped. A saved link has the same one — "read this properly" stops being a
bookmark you never revisit. A task can be dragged onto the calendar to become a
time block, and completing the block completes the task and logs the points in one
action rather than three. Recurring work re-enters the chain on its own, which is
the point of it: a routine you have to remember is not a routine.

**Effort is scored, outcomes are not.** Points come from actions entirely within
your control, and the spread is deliberately narrow — when one action pays far
more than the others you start optimising for the score instead of the work. There
is no "you broke your streak" screen anywhere in the product, and a `Minimal`
setting hides points and levels entirely, turning it back into a plain tracker.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind v4, tokens in `app/globals.css` |
| Database | Neon Postgres via Prisma 7 + `@prisma/adapter-pg` |
| Auth | Own session cookies — no auth library |
| Mutations | Server Actions, validated with Zod at every boundary |
| Mail | Resend, with a file-backed fallback in development |
| Tests | Vitest — 2763 unit, 49 integration |

No component library, no animation library, no drag library. Dragging notes and
calendar blocks is pointer events and stored coordinates.

## Getting started

Needs Node 20+ and a Neon project.

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` — every variable is documented in `.env.example`, which holds
names only and never values. The two that need care:

- **`DATABASE_URL`** — Neon's *pooled* endpoint, the host containing `-pooler`.
  The running app uses this.
- **`DIRECT_URL`** — the same host *without* `-pooler`. Migrations only; schema
  changes cannot run through a transaction pooler, and a pooled URL here fails
  with an error that never mentions pooling.

Then:

```bash
npx prisma migrate deploy
npm run dev
```

Mail needs no configuration in development. With `RESEND_API_KEY` empty, messages
are written to `.mail/` instead of being sent, so password reset and email
verification both work before a domain exists.

## Scripts

```bash
npm run dev               # dev server
npm run build             # production build
npm test                  # unit tests — no database needed
npm run test:integration  # integration tests — needs a database
npm run test:all          # both
npm run lint              # eslint
```

Before pushing, run all four of `tsc --noEmit`, `eslint`, `npm test` and
`npm run build`. CI runs the same set, and finding out there from an email is a
slower way to learn the same thing.

## Tests

Two Vitest projects, because they have different requirements:

- **`unit`** — pure functions: recurrence, week and month arithmetic, scoring,
  search parsing, validation, the SSRF guard, image sniffing. No database, no
  network, runs in a second.
- **`integration`** — real Prisma against a real Postgres, covering the things
  that only break once rows exist: tag reuse across content types, cross-user
  isolation, multi-term search, reward affordability, routine projection onto the
  calendar. Each test makes its own user and cleans up after itself.

The integration suite needs `DATABASE_URL` pointing somewhere disposable. Point it
at a Neon branch or a local Postgres — never at the database you actually use.

## Environments

Four branches, promoted in one direction only, with `prod` as the default:

```
dev  →  qa  →  stage  →  prod
```

Never commit directly to `qa`, `stage` or `prod` — fast-forward them instead, so
every environment is a commit that already existed and passed CI further back.
The full rules, including what to do when `--ff-only` refuses, are in
[`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md).

Each environment should get its own Neon branch, so a bad migration in dev can
never reach production data.

## Layout

```
app/            routes — (auth) is public, /app is session-gated
  globals.css   every colour, font and radius token
components/     UI, grouped by feature
lib/            domain logic — pure and unit-tested
  repositories/ the only place Prisma is touched
design/icon/    icon masters
prisma/         schema and migrations
tests/          unit tests, plus tests/integration
docs/           environment and process notes
```

## Conventions worth knowing

These are the ones that have already cost time:

- **Client components must never import from `lib/repositories/*`.** It drags
  Prisma, `pg`, `net` and `tls` into the browser bundle. This passes both `tsc`
  and `eslint` and fails at runtime.
- **Every repository function takes `userId` as a required argument.** There is no
  row-level security behind it; that argument is the authorisation boundary.
- **`point_ledger` is append-only**, enforced by a database trigger. Deleting from
  it needs an explicit transaction-local escape hatch, which the test harness uses
  and nothing else should.
- **Writing a hidden input's value from React fires no native event.** Forms
  watching for changes never notice, so dispatch one manually.
- **Colour, spacing and radius live only in `app/globals.css`.** Changing the whole
  look should be editing one file, never touching components.

## Licence

Private project. Not currently licensed for reuse.
