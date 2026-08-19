-- Tags can carry a colour, as the design shows: most stay plain grey,
-- a couple are picked out. Same palette as areas, so a colour means the
-- same thing whichever kind of label it is on.
ALTER TABLE "tags" ADD COLUMN "colour" TEXT NOT NULL DEFAULT 'mut';
