# Architecture Decision Records

This directory records decisions that shape Daily Portal as a self-hosted open source project.

ADRs are intentionally short. They should explain the context, the decision, and the trade-offs so future contributors can understand why the system is built this way.

## Index

- [0001: Monorepo with NestJS and Angular](./0001-monorepo-nestjs-angular.md)
- [0002: SQLite and Redis for homelab operations](./0002-sqlite-redis-homelab.md)
- [0003: Single deployable backend image with embedded frontend](./0003-single-image-static-frontend.md)
- [0004: Documentation portal and generated references](./0004-documentation-portal.md)

## When to add an ADR

Add or update an ADR when a change affects deployment topology, storage, public APIs, integration boundaries, security posture, or long-term maintenance.
