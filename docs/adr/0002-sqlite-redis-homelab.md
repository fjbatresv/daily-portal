# ADR 0002: SQLite and Redis for Homelab Operations

## Status

Accepted.

## Context

The portal stores local reminders and notification logs, while external integrations are read-heavy and rate-limit sensitive. It should run reliably on a Raspberry Pi without requiring a managed database.

## Decision

Use SQLite through `better-sqlite3` for durable local state and Redis for short-lived integration cache.

SQLite is accessed directly from repository classes. Redis is wrapped by `CacheService`, and each external integration must check cache before calling a remote API.

## Consequences

The production deployment stays small and portable. Backups are straightforward because durable data lives in `data/portal.db`.

The trade-off is that SQLite is not intended for high-concurrency multi-user workloads. That is acceptable because Daily Portal is a personal dashboard.
