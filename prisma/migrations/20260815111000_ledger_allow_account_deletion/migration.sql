-- The append-only trigger was too absolute: deleting a user cascades to
-- their ledger rows, and the trigger blocked that too. "Delete my
-- account" would have failed with a confusing error about append-only
-- history — a bug that would only have surfaced the first time someone
-- tried to leave.
--
-- The fix keeps the guarantee for every ordinary operation and opens a
-- single, explicit door. Deleting an account must set a transaction-local
-- flag first:
--
--   SET LOCAL krama.allow_ledger_delete = 'on';
--
-- SET LOCAL dies with the transaction, so it cannot leak into later
-- queries on a pooled connection.

CREATE OR REPLACE FUNCTION krama_reject_ledger_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('krama.allow_ledger_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION
    'point_ledger is append-only: % is not permitted. Append a correcting entry instead.',
    TG_OP;
END;
$$ LANGUAGE plpgsql;
