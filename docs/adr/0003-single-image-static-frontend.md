# ADR 0003: Single Deployable Backend Image with Embedded Frontend

## Status

Accepted.

## Context

The target deployment is a Raspberry Pi exposed through Cloudflare Tunnel or another reverse proxy. Running a separate frontend container adds operational overhead for little benefit in this project.

## Decision

Build Angular inside the backend Dockerfile and copy the compiled SPA into the final NestJS image.

By default, `SERVE_STATIC=true` lets NestJS serve the SPA and API from the same container. For standalone installs that prefer nginx, `SERVE_STATIC=false` and the `nginx` Docker Compose profile can serve static files while proxying `/api/*`.

## Consequences

The default deployment is one application container, Redis, and a SQLite volume. Cloudflare Tunnel can point directly to `HOST_PORT`, default `8090`.

The trade-off is that frontend-only changes still rebuild the backend image.
