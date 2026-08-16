-- Which five tints a sticky note can be. Preset names rather than raw
-- colours: a free picker would let someone choose a tint that the note's
-- own text cannot be read on, and every preset here is desaturated so a
-- full board doesn't fight the interface.
ALTER TABLE "profiles"
  ADD COLUMN "noteTints" TEXT[] NOT NULL
  DEFAULT ARRAY['amber','sky','rose','violet','slate']::TEXT[];
