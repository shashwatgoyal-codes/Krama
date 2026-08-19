
-- CreateTable
CREATE TABLE "_LinkToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LinkToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_EventToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EventToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TagToTask" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TagToTask_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_NoteToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_NoteToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_LinkToTag_B_index" ON "_LinkToTag"("B");

-- CreateIndex
CREATE INDEX "_EventToTag_B_index" ON "_EventToTag"("B");

-- CreateIndex
CREATE INDEX "_TagToTask_B_index" ON "_TagToTask"("B");

-- CreateIndex
CREATE INDEX "_NoteToTag_B_index" ON "_NoteToTag"("B");

-- AddForeignKey
ALTER TABLE "_LinkToTag" ADD CONSTRAINT "_LinkToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LinkToTag" ADD CONSTRAINT "_LinkToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventToTag" ADD CONSTRAINT "_EventToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventToTag" ADD CONSTRAINT "_EventToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTask" ADD CONSTRAINT "_TagToTask_A_fkey" FOREIGN KEY ("A") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTask" ADD CONSTRAINT "_TagToTask_B_fkey" FOREIGN KEY ("B") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_NoteToTag" ADD CONSTRAINT "_NoteToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_NoteToTag" ADD CONSTRAINT "_NoteToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------
-- Carry the links' free-text tags onto the real Tag table.
--
-- Links were the only content type that ever had tags, and they had
-- their own: a String[] that never referenced the tags table, so a tag
-- created in Settings and a tag typed on a link were different things
-- wearing the same word. This moves the typed ones into the real table
-- before the column goes, so nothing a user wrote is lost to the
-- refactor.
-- ---------------------------------------------------------------------

-- Names that were only ever strings become real tags, owned by whoever
-- typed them. A deterministic id keeps this statement re-runnable.
INSERT INTO "tags" ("id", "userId", "name", "colour", "createdAt", "usedAt")
SELECT DISTINCT
  'lnktag_' || md5(l."userId" || ':' || btrim(t.name)),
  l."userId",
  btrim(t.name),
  'mut',
  now(),
  now()
FROM "links" l
CROSS JOIN LATERAL unnest(l."tags") AS t(name)
WHERE btrim(t.name) <> ''
ON CONFLICT ("userId", "name") DO NOTHING;

-- Then the links point at them.
INSERT INTO "_LinkToTag" ("A", "B")
SELECT DISTINCT l."id", tg."id"
FROM "links" l
CROSS JOIN LATERAL unnest(l."tags") AS t(name)
JOIN "tags" tg
  ON tg."userId" = l."userId"
 AND tg."name" = btrim(t.name)
WHERE btrim(t.name) <> ''
ON CONFLICT DO NOTHING;

-- Only now is the old column safe to remove.
ALTER TABLE "links" DROP COLUMN "tags";
