# What Krama keeps, and what it clears

Nothing was removed from this database until the sweep in
`lib/repositories/retention.ts` existed. Every row ever written was still
there — including one dropped task per routine per skipped day, forever.

The sweep runs beside `runDayMaintenance`, on the first page load of a
person's day. There is no scheduler, and adding one for this would be
infrastructure to maintain in exchange for work that is already idempotent
and already happens.

## The line it draws

**Noise — removed automatically.** Rows that record an absence, or a
moment that has passed.

| What | Kept for | Why it goes |
|---|---|---|
| A skipped routine day (`status = dropped`) | 30 days | Long enough to notice a routine you keep missing. After that it is one identical row per day. |
| An expired session | 7 days past expiry | It cannot authenticate anything. These were only ever deleted when someone happened to present one, so a device signed into once and never opened again kept its row indefinitely. |
| Spent and expired one-time codes | Immediately / 24h | `purgeStaleCodes` existed for this from the beginning and was never called from anywhere. |
| Rate-limit rows | 30 days | Past the window they cannot influence any decision. |

**History — kept.** What someone actually did.

- Finished tasks are kept **forever** by default. A person can choose a
  limit in Settings → Data; there is no default that quietly deletes
  their record to save space.
- Notes and saved links go when the person removes them, never on a timer.
- `point_ledger` and `audit_log` cannot be removed at all. Both are
  append-only, enforced by a trigger that rejects `UPDATE` and `DELETE`.
  Account deletion opens a transaction-local escape hatch; nothing else
  can.

## Why deleting a task does not cost points

`point_ledger` holds **no foreign key to `tasks`**. A ledger row records
what happened and how much it was worth; it does not point at the row that
caused it. So sweeping a task removes the plan and leaves the history, and
`profiles.totalPoints` still reconciles against the ledger.

This is the single property that makes any of this safe, so it is a test
rather than a comment — see `tests/integration/retention.int.test.ts`,
"points survive the task they came from being swept away". If it ever
stopped being true, this feature would quietly delete somebody's score.

## Scope

`sweep()` takes a `userId` and every task and session query is scoped to
it. The two exceptions are deliberate and hold nothing personal: rate-limit
rows are keyed by address and email rather than by account, and one-time
codes are cleared globally once spent.

## What is not handled here

Backups. Neon's history retention is a rollback window, not a backup —
losing the project loses the history with it. A monthly `pg_dump` stored
off-platform is still outstanding.
