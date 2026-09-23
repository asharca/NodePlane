#!/bin/sh
# This image only connects to the PostgreSQL service in this Compose project.
set -eu

: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"

for tool in psql migrate; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "Missing $tool: use the version-matched NodePlane migrator image" >&2
        exit 1
    fi
done
for service in auth subscription checker scheduler notify settings; do
    if [ ! -d "/migrations/$service" ] || ! ls "/migrations/$service/"*.up.sql >/dev/null 2>&1; then
        echo "Missing migration SQL for $service in the image" >&2
        exit 1
    fi
done

# libpq and golang-migrate's PostgreSQL driver both read PGUSER/PGPASSWORD.
# Do not concatenate credentials into a URI: @, :, /, %, etc. must stay literal.
# These values are NOT printed, passed in argv, or written to container logs.
export PGHOST=postgres PGPORT=5432 PGSSLMODE=disable PGCONNECT_TIMEOUT=10
export PGUSER="$DB_USER" PGPASSWORD="$DB_PASSWORD"
unset PGDATABASE PGSERVICE PGSERVICEFILE PGHOSTADDR PGOPTIONS

echo "==> Preparing local PostgreSQL databases"
# Re-runnable initialization creates only absent databases; never drops data.
psql -X --no-password --set=ON_ERROR_STOP=1 --dbname=postgres --file=/deploy/init.sql

for service in auth subscription checker scheduler notify settings; do
    echo "==> Migrating: $service"
    if ! migrate -path "/migrations/$service" \
        -database "postgres://postgres:5432/$service?sslmode=disable&connect_timeout=10" up; then
        echo "Migration failed for $service; backend startup is blocked. No force/reset was attempted." >&2
        exit 1
    fi
done

echo "==> All migrations complete"
