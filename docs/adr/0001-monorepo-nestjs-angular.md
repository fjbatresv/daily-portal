# ADR 0001: Monorepo with NestJS and Angular

## Status

Accepted.

## Context

Daily Portal combines a personal operations API, scheduled jobs, external integrations, and a web dashboard. The project is intended to run in a homelab, remain easy to fork, and be understandable as a portfolio project.

The backend and frontend evolve together because the API payloads map directly to dashboard views and Telegram digest formatting.

## Decision

Use a single npm workspace monorepo with:

- `backend/`: NestJS API, scheduler, integrations, Telegram sender, SQLite access.
- `frontend/`: Angular standalone SPA with signals.
- `docs-site/`: Astro Starlight documentation portal.
- root scripts for shared checks, documentation, build, and CI.

## Consequences

Contributors can clone one repository and run one dependency install from the root. API, frontend models, docs, and deployment files can be reviewed together in a single pull request.

The trade-off is a larger root lockfile and a need to keep workspace scripts disciplined.
