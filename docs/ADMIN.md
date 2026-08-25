# The admin portal's database role

The portal reads through a **different Postgres role** from the one the app
runs as. That role has `SELECT` on metadata columns and on nothing else — not
the body of a note, not the title of a task, not the text of anything a user
wrote.

The reason for putting the boundary here rather than in the queries is that
being careful in a query does not survive a codebase. One `findMany` without a
`select`, one new endpoint, one debugging line, and content reaches a screen it
should never reach. With the grant withheld, that query does not quietly return
too much — it fails.

`lib/admin/db.ts` refuses to fall back to the application connection when
`ADMIN_DATABASE_URL` is missing. A seal that opens when misconfigured is not a
seal.

## Creating the role

Run this **once per environment**, against that environment's database, as the
owner role. Choose your own password and keep it out of version control.

```sql
-- 1. The role itself.
CREATE ROLE krama_admin WITH LOGIN PASSWORD 'replace-me';

-- 2. It may see the schema, and nothing by default.
GRANT USAGE ON SCHEMA public TO krama_admin;

-- 3. Metadata about accounts. Note what is absent: passwordHash, and the
--    avatar bytes.
GRANT SELECT ("id", "email", "name", "emailVerified", "createdAt")
  ON users TO krama_admin;

-- 4. Enough of a profile to say where someone is, and how they have things
--    configured. No content.
--
--    "id" is here because Prisma needs a relation's primary key to build
--    the object, even when you never select it. Omitting it fails with
--    "permission denied for table profiles", which reads like the whole
--    table is barred rather than one column.
GRANT SELECT ("id", "userId", "timezone", "level", "totalPoints", "streakDays")
  ON profiles TO krama_admin;

-- 5. Sessions, for "last seen" and "how many devices". tokenHash is withheld:
--    an admin has no business holding anything replayable as a cookie.
GRANT SELECT ("id", "userId", "createdAt", "expiresAt") ON sessions TO krama_admin;

-- 6. Counting rows requires selecting a column. Only the owning key and the
--    timestamps are granted, which is enough to count and not enough to read.
GRANT SELECT ("id", "userId", "createdAt") ON tasks  TO krama_admin;
GRANT SELECT ("id", "userId", "createdAt") ON notes  TO krama_admin;
GRANT SELECT ("id", "userId", "createdAt") ON events TO krama_admin;
GRANT SELECT ("id", "userId", "savedAt")   ON links  TO krama_admin;

-- 7. Operational tables the portal reports on.
GRANT SELECT ON auth_attempts TO krama_admin;
GRANT SELECT ON admin_roles   TO krama_admin;
GRANT SELECT ON admin_invites TO krama_admin;
GRANT SELECT ON audit_log     TO krama_admin;

-- 8. Nothing may be written through this role, ever. Audit entries are written
--    by the application's connection, into a table that rejects UPDATE and
--    DELETE by trigger.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public
  FROM krama_admin;

-- 9. And nothing new becomes readable by default when a table is added later.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM krama_admin;
```

Then set, alongside `DATABASE_URL`:

```
ADMIN_DATABASE_URL=postgresql://krama_admin:...@<same-pooled-host>/<db>?sslmode=verify-full
SUPER_ADMIN_EMAIL=<the one owner account>
```

## Checking it worked

The point is that the *wrong* query fails. From `psql` as `krama_admin`:

```sql
SELECT count(*) FROM users;        -- works
SELECT "body" FROM notes LIMIT 1;  -- must fail: permission denied for column body
```

If the second one returns a row, the grant is wrong and the portal's promise is
not being kept. Fix the grant; do not work around it in the query.

## Adding a table later

New tables are unreadable by this role by default, which is the safe direction.
If the portal needs to count rows in one, grant `SELECT` on its key and
timestamps only — never `SELECT ON <table>` without a column list, which grants
every column including ones added afterwards.
