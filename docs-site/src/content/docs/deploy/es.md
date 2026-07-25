---
title: Operacion y Despliegue
description: Guia de Docker, Raspberry Pi y Cloudflare Tunnel en espanol.
---

## Modelo de despliegue

Daily Portal se despliega con Docker Compose en Raspberry Pi Debian 13 aarch64. Cloudflare Tunnel apunta al puerto del host definido por `HOST_PORT`, por defecto `8090`.

## Modo default: NestJS sirve Angular

Con `SERVE_STATIC=true`, NestJS sirve el frontend Angular embebido y expone la API bajo `/api/*`.

```bash
docker compose up -d --build
```

Este es el modo recomendado cuando Cloudflare Tunnel o Caddy apuntan directamente al backend.

## Modo nginx

Con `SERVE_STATIC=false`, NestJS expone solo `/api/*` y nginx sirve el frontend. Usa el perfil `nginx`:

```bash
SERVE_STATIC=false docker compose -f docker-compose.yml -f docker-compose.nginx-override.yml --profile nginx up -d --build
```

## Variables importantes

- `HOST_PORT`: puerto publicado al host; default `8090`.
- `SERVE_STATIC`: `true` para NestJS estatico, `false` para nginx.
- `SQLITE_PATH`: ruta del archivo SQLite dentro del contenedor.
- `REDIS_URL`: URL de Redis.
- `MORNING_DIGEST_CRON` y `TZ`: horario del digest.

## Operacion

Valida salud del backend:

```bash
curl http://localhost:8090/api/health
```

Recalcula el digest:

```bash
curl -X POST http://localhost:8090/api/dashboard/refresh
```

Los datos SQLite viven en `data/`, que esta ignorado por git y debe respaldarse fuera del repo si importa conservar historial.

## Documentacion publica

Para publicar el portal de documentacion en GitHub Pages:

1. En el repositorio, configura Pages con **Source: GitHub Actions**.
2. Publica un GitHub Release o ejecuta manualmente el workflow `Documentation Release`.
3. El workflow genera Compodoc, TypeDoc, OpenAPI reference/playground y Starlight en `docs-site/dist`.

En forks, GitHub Pages usara la subruta del repositorio, por ejemplo `https://OWNER.github.io/REPO/`.
