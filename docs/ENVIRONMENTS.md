# Environments

Four branches, promoted in one direction only:

```
dev  →  qa  →  stage  →  prod
```

| Branch  | Purpose                              | Who breaks it            |
| ------- | ------------------------------------ | ------------------------ |
| `dev`   | Active development. Expect breakage. | Anyone, any time         |
| `qa`    | Feature testing once dev is stable   | Only via promotion       |
| `stage` | Final rehearsal — prod-like          | Only via promotion       |
| `prod`  | The live app                         | Only via promotion       |

`prod` is the repository's default branch. `main` was deleted once `prod`
took that role — a second branch tracking the same commits was only ever
somewhere to push to by accident.

## Promoting

Never commit directly to `qa`, `stage` or `prod`. Fast-forward them instead, so
every environment is a commit that already existed and passed CI further back:

```bash
git checkout qa && git merge --ff-only dev && git push origin qa
```

Same shape for `stage` (from `qa`) and `prod` (from `stage`). If `--ff-only`
refuses, something was committed directly to that branch — find out what before
forcing anything.

## What CI does

`.github/workflows/ci.yml` runs on every push and pull request to these
branches: `tsc --noEmit`, `eslint`, the unit tests, `prisma migrate deploy`
against a throwaway Postgres service container, the integration tests against
that database, and a full `next build`.

The unit and integration runs are separate steps on purpose, so a red build
names which kind broke instead of showing one X.

It runs **without any secrets**. That is deliberate and worth preserving — the
Prisma client is constructed lazily, so nothing touches a database at build
time. If the *build* ever starts failing for a missing `DATABASE_URL`, the real
problem is that something now queries during the build.

The database CI does use is a `postgres:16-alpine` service container created
fresh for each run, with a throwaway password in plain sight in the workflow.
It exists for the length of the job and holds nothing.

## The database

**Right now all four environments share one Neon database.** This is a
deliberate temporary choice, not an oversight, but it means there is no safety
net: a destructive migration run against `dev` hits production data too.

Before anyone else uses the app, split it — Neon branches are near-instant and
each one gets its own connection string:

```
neon branches create --name qa
```

Then set `DATABASE_URL` / `DIRECT_URL` per deployment. Nothing in the code needs
to change; `lib/neon.ts` derives the direct URL from the pooled one.

## The badge

Every environment except production shows a coloured chip beside the wordmark in
the top bar — `Dev`, `QA`, `Staging`. Production is deliberately unlabelled.

This exists because of the shared database above: with four environments and one
set of data, the easy mistake is doing real work in what you assumed was a
throwaway environment. An unrecognised or missing `APP_ENV` reads as `dev`, so
the failure mode is a badge that shouldn't be there rather than a missing one.

## Secrets

`.gitignore` ignores `.env*` and re-includes only `.env.example`. Real values
live in `.env.local` locally, and in the host's environment settings per
deployment.

The Neon password currently in use was pasted into a chat transcript during
development and **should be rotated** before the app is public.
