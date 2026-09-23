\set ON_ERROR_STOP on
-- Serialize bootstrap across concurrent migrators without wrapping CREATE
-- DATABASE in a transaction. The connection releases this lock on any error.
SELECT pg_advisory_lock(7263102401);
SELECT format('CREATE DATABASE %I OWNER %I', required.name, current_user)
FROM (VALUES ('auth'), ('subscription'), ('checker'), ('scheduler'), ('notify'), ('settings')) AS required(name)
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = required.name)
\gexec
SELECT pg_advisory_unlock(7263102401);
