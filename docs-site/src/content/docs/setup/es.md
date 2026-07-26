---
title: Setup Local
description: Guia de desarrollo local en espanol.
---

## Prerequisitos

- Node.js 24 LTS gestionado con `nvm`.
- npm 10 o superior.
- Docker y Docker Compose para validar el modo de produccion.
- Credenciales de Jira, GitHub, Google Calendar, Slack y Telegram solo si vas a probar integraciones reales.

## Instalacion

Desde la raiz del repo:

```bash
source ~/.nvm/nvm.sh
nvm use
npm install
```

Copia el ejemplo de variables:

```bash
cp .env.example .env
```

Completa `.env` con tus valores locales. No guardes secretos reales en git.

## Ejecucion local

Backend:

```bash
cd backend
source ~/.nvm/nvm.sh
nvm use
npm run start:dev
```

Frontend:

```bash
cd frontend
source ~/.nvm/nvm.sh
nvm use
npm run start
```

## Checks

```bash
source ~/.nvm/nvm.sh
nvm use
npm run format:check
npm run docstrings:check
npm run lint
npm run test
npm run build
npm run docs:check
```
