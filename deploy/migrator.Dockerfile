FROM migrate/migrate:v4.18.1 AS migration_tool
FROM alpine:3.22

# Installed at image build time, never on the deployment server at startup.
RUN apk add --no-cache ca-certificates postgresql17-client
COPY --from=migration_tool /usr/local/bin/migrate /usr/local/bin/migrate
COPY deploy/migrate.sh deploy/init.sql /deploy/
COPY services/auth/migrations/ /migrations/auth/
COPY services/subscription/migrations/ /migrations/subscription/
COPY services/checker/migrations/ /migrations/checker/
COPY services/scheduler/migrations/ /migrations/scheduler/
COPY services/notify/migrations/ /migrations/notify/
COPY services/settings/migrations/ /migrations/settings/
RUN migrate -version && psql --version && sh -n /deploy/migrate.sh
USER 65534:65534
ENTRYPOINT ["/bin/sh", "/deploy/migrate.sh"]
