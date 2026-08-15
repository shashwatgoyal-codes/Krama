-- The points ledger is the source of truth for every score in the app.
-- Level, streak and pace are all recomputed from it, never edited.
--
-- Enforce that in the database rather than in application code: a bug,
-- a console session or a future careless query cannot rewrite history.
-- Corrections are made by appending a compensating row.

CREATE OR REPLACE FUNCTION krama_reject_ledger_change()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'point_ledger is append-only: % is not permitted. Append a correcting entry instead.',
    TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS point_ledger_no_update ON "point_ledger";
CREATE TRIGGER point_ledger_no_update
  BEFORE UPDATE ON "point_ledger"
  FOR EACH ROW EXECUTE FUNCTION krama_reject_ledger_change();

DROP TRIGGER IF EXISTS point_ledger_no_delete ON "point_ledger";
CREATE TRIGGER point_ledger_no_delete
  BEFORE DELETE ON "point_ledger"
  FOR EACH ROW EXECUTE FUNCTION krama_reject_ledger_change();
