-- AlterTable
ALTER TABLE "users" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;

-- The admin portal reads through a restricted role. It needs to see that
-- an account is suspended and why; it still cannot see anything the
-- person wrote. Kept here so the grant travels with the column rather
-- than being remembered separately per environment.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'krama_admin') THEN
    GRANT SELECT ("suspendedAt", "suspendedReason") ON users TO krama_admin;
  END IF;
END
$$;
