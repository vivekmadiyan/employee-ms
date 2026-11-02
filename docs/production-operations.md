# Production operations

This runbook complements provider-managed backups and monitoring. Keep credentials in the hosting provider's secret manager; never put production values in source control or an E2E environment.

## Database recovery

1. Enable automated daily backups and point-in-time recovery with the database provider. Retain backups according to the organization's legal and customer requirements.
2. Before launch and after material schema changes, restore a recent backup into a separate, isolated database. Do not rehearse against the live database.
3. Validate the restored database with `pg_restore --list` before restoring a custom-format dump. For a provider-exported SQL dump, use the provider's documented restore procedure.
4. Run the application against the restored database and verify `/api/health`, login, employee/team access, and leave workflows. Record the backup timestamp, restore duration, validation results, and owner.
5. For an actual recovery, pause writes or maintenance-mode the application, select the last known-good restore point, restore to a new database, validate it, and only then update the API's `DATABASE_URL`. Keep the old database and restore point until service and data integrity are confirmed.

For a manually managed PostgreSQL deployment, use encrypted storage and the provider's secret-management mechanism for credentials:

```sh
pg_dump --format=custom --no-owner --file=ems-backup.dump "$DATABASE_URL"
pg_restore --list ems-backup.dump
```

Do not run restore commands against the production database as a routine test.

## Monitoring and alerts

- Check `/api/health` for API and database readiness and `/api/health/live` for process liveness.
- Scrape `/api/metrics` only from a trusted monitoring network and configure `METRICS_TOKEN` as a secret.
- Alert on sustained readiness failures, elevated HTTP 5xx rates, database connection exhaustion, failed backup jobs, and backup age exceeding the recovery-point objective.
- Route alerts to an owned on-call channel. Record an incident owner, customer communication path, and escalation process.
- Review logs using request IDs; avoid logging passwords, tokens, invitation links, or employee-sensitive data.

The hosting provider must be configured to deliver alerts and perform/retain backups; application endpoints do not create those provider-side controls automatically.
