---
title: Daily Portal
description: Entrada principal para arquitectura, modulos, API y operacion del portal.
---

Daily Portal agrega Jira, GitHub, Google Calendar, Slack y recordatorios locales para producir un digest diario accionable. El backend NestJS expone `/api/*`, el frontend Angular se sirve desde la misma imagen Docker y el despliegue objetivo corre en Raspberry Pi detras de Cloudflare Tunnel.

## Lecturas principales

- [Arquitectura](./architecture/overview/) describe el flujo de datos, los contenedores y las fronteras entre modulos.
- [ADRs](./decisions/adr/) explican las decisiones de arquitectura principales para contributors y forks.
- [Modulos](./modules/jira/) enlaza las especificaciones funcionales existentes sin duplicarlas.
- [API Reference](./api-reference/) publica `openapi.yaml` como contrato navegable.
- [API Playground](./api-playground/) permite probar endpoints contra una URL base configurable.
- [Setup](./setup/es/) y [operacion](./deploy/es/) estan disponibles en espanol e ingles.

## Referencias generadas

- [Frontend Compodoc](./reference/frontend/) para componentes standalone, servicios, stores y modelos Angular.
- [Backend TypeDoc](./reference/backend/) para la referencia tecnica de NestJS.

Estas salidas se generan durante los checks de documentacion y no deben editarse manualmente.
