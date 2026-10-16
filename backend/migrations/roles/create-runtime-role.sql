-- Run once by the database operator (superuser or CREATEROLE). Creates the NOLOGIN group
-- that the runtime login is a member of. Never grant CREATE, TRUNCATE, ownership or superuser.
-- Table grants are applied by `node dist/src/database/migrate.js` after each migration.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'yarizan_runtime') THEN
    CREATE ROLE yarizan_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
-- Example binding, executed by the operator with a server-generated password (not stored here):
--   CREATE ROLE yarizan_api LOGIN PASSWORD '<generated>' NOSUPERUSER NOCREATEDB NOCREATEROLE IN ROLE yarizan_runtime;
--   ALTER ROLE yarizan_api SET role = 'yarizan_runtime';
