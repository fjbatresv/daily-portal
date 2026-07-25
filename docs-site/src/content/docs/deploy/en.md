---
title: Operations and Deployment
description: Docker, Raspberry Pi and Cloudflare Tunnel guide in English.
---

## Deployment Model

Daily Portal runs with Docker Compose on Raspberry Pi Debian 13 aarch64. Cloudflare Tunnel points to the host port defined by `HOST_PORT`, defaulting to `8090`.

## Default Mode: NestJS Serves Angular

With `SERVE_STATIC=true`, NestJS serves the embedded Angular frontend and exposes the API under `/api/*`.

```bash
docker compose up -d --build
```

This is the recommended mode when Cloudflare Tunnel or Caddy points directly to the backend.

## nginx Mode

With `SERVE_STATIC=false`, NestJS exposes only `/api/*` and nginx serves the frontend. Use the `nginx` profile:

```bash
SERVE_STATIC=false docker compose -f docker-compose.yml -f docker-compose.nginx-override.yml --profile nginx up -d --build
```

## Important Variables

- `HOST_PORT`: host port exposed by Docker; default `8090`.
- `SERVE_STATIC`: `true` for NestJS static serving, `false` for nginx.
- `SQLITE_PATH`: SQLite file path inside the container.
- `REDIS_URL`: Redis URL.
- `MORNING_DIGEST_CRON` and `TZ`: digest schedule.

## Operations

Check backend health:

```bash
curl http://localhost:8090/api/health
```

Force a digest refresh:

```bash
curl -X POST http://localhost:8090/api/dashboard/refresh
```

SQLite data lives in `data/`, which is ignored by git and should be backed up outside the repository when history matters.

## Public Documentation

To publish the documentation portal on GitHub Pages:

1. Configure Pages with **Source: GitHub Actions** in the repository settings.
2. Publish a GitHub Release or manually run the `Documentation Release` workflow.
3. The workflow generates Compodoc, TypeDoc, OpenAPI reference/playground and Starlight into `docs-site/dist`.

For forks, GitHub Pages uses the repository subpath, for example `https://OWNER.github.io/REPO/`.
