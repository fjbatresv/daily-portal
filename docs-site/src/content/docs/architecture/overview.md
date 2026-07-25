---
title: Arquitectura
description: Vista tecnica del sistema Daily Portal.
---

Daily Portal es un monorepo con backend NestJS, frontend Angular, SQLite para persistencia local, Redis para cache de integraciones y Docker Compose como unidad de despliegue.

## Flujo principal

1. `SchedulerModule` dispara el digest matutino segun `MORNING_DIGEST_CRON` y `TZ`.
2. `DailyAggregatorService` consulta Jira, GitHub, Google Calendar, Slack y recordatorios.
3. Las integraciones usan `CacheService` antes de llamar APIs externas.
4. Los fallos externos se aislan con resultados vacios y logging de NestJS.
5. `DashboardController` expone el digest y `TelegramModule` envia el resumen.

## Despliegue

La imagen del backend se construye desde la raiz del repo. El Dockerfile compila Angular en un stage separado, compila NestJS y copia el frontend final a `/app/public`.

`SERVE_STATIC=true` hace que NestJS sirva la SPA. `SERVE_STATIC=false` deja a NestJS solo con `/api/*` y habilita el perfil nginx para servir archivos estaticos.

## Documentacion fuente

Las especificaciones largas siguen viviendo en `docs/` y se enlazan desde este portal. Las decisiones de arquitectura viven en `docs/adr/`. El objetivo del portal es navegacion, publicacion y referencias generadas, no duplicar cada detalle.
