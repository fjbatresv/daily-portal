# Daily Portal

[![CI](https://github.com/fjbatresv/daily-portal/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/fjbatresv/daily-portal/actions/workflows/ci.yml)
[![Docker Image](https://github.com/fjbatresv/daily-portal/actions/workflows/docker-image.yml/badge.svg?branch=main)](https://github.com/fjbatresv/daily-portal/actions/workflows/docker-image.yml)
[![Documentation Release](https://github.com/fjbatresv/daily-portal/actions/workflows/docs-release.yml/badge.svg)](https://github.com/fjbatresv/daily-portal/actions/workflows/docs-release.yml)
[![Snyk Security](https://github.com/fjbatresv/daily-portal/actions/workflows/snyk.yml/badge.svg?branch=main)](https://github.com/fjbatresv/daily-portal/actions/workflows/snyk.yml)
[![Quality gate status](https://sonarcloud.io/api/project_badges/measure?project=fjbatresv_daily-portal&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=fjbatresv_daily-portal)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=fjbatresv_daily-portal&metric=bugs)](https://sonarcloud.io/summary/new_code?id=fjbatresv_daily-portal)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=fjbatresv_daily-portal&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=fjbatresv_daily-portal)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=fjbatresv_daily-portal&metric=coverage)](https://sonarcloud.io/summary/new_code?id=fjbatresv_daily-portal)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=fjbatresv_daily-portal&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=fjbatresv_daily-portal)

![Node.js](https://img.shields.io/badge/Node.js-24_LTS-5FA04E?logo=nodedotjs&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?logo=nestjs&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-22.x-DD0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-8-FF4438?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![nginx](https://img.shields.io/badge/nginx-optional-009639?logo=nginx&logoColor=white)
![Raspberry Pi](https://img.shields.io/badge/Raspberry_Pi-aarch64-A22846?logo=raspberrypi&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-digest-26A5E4?logo=telegram&logoColor=white)
![Jira](https://img.shields.io/badge/Jira-integration-0052CC?logo=jira&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-integration-181717?logo=github&logoColor=white)
![Google Calendar](https://img.shields.io/badge/Google_Calendar-integration-4285F4?logo=googlecalendar&logoColor=white)
![Slack](https://img.shields.io/badge/Slack-integration-4A154B?logo=slack&logoColor=white)

A self-hosted personal dashboard that aggregates your daily tasks from multiple sources and sends a morning briefing via Telegram.

Daily Portal is designed as free software that can be forked, self-hosted, and adapted to different personal workflows. It runs containerized on a Raspberry Pi or any Docker host, and can be exposed through Cloudflare Tunnel, Caddy, nginx, or another reverse proxy.

---

## Features

- **Unified TODO list** — prioritized view of everything that needs your attention today
- **Jira** — assigned tickets (To Do + In Progress)
- **GitHub** — open PRs with conflict detection, check status and new comment alerts
- **Google Calendar** — today's events from up to 2 calendars, with Meet links
- **Slack** — recent mentions using your personal User Token (no bot required)
- **Reminders** — personal reminders with dynamic priority escalation based on days overdue
- **Telegram digest** — daily message at 8 AM with a prioritized summary
- **Dark/Light mode** — Aurora palette, persisted per user

---

## Tech stack

| Layer         | Technology                         |
| ------------- | ---------------------------------- |
| Backend       | NestJS 11.x                        |
| Frontend      | Angular 22.x (standalone, signals) |
| Database      | SQLite via `better-sqlite3`        |
| Cache         | Redis 8                            |
| Runtime       | Node.js 24 LTS                     |
| Containers    | Docker Compose v5                  |
| Reverse proxy | nginx (optional profile)           |

---

## Architecture

See [`daily-portal-architecture.md`](./daily-portal-architecture.md) for C4 diagrams, sequence diagrams and infrastructure layout.

The full REST API spec is in [`openapi.yaml`](./openapi.yaml).

Architecture decisions are recorded in [`docs/adr/`](./docs/adr/). Start there before changing deployment topology, persistence, integration boundaries, or documentation tooling.

## Documentation

The documentation portal lives in [`docs-site/`](./docs-site) and is built with Astro Starlight.

```bash
source ~/.nvm/nvm.sh
nvm use
npm run docs:dev
npm run docs:check
npm run docs:build
```

The portal includes:

- curated setup and deployment guides in English and Spanish
- links to existing module specs under `docs/`
- Compodoc frontend reference
- TypeDoc backend reference
- OpenAPI reference and playground generated from `openapi.yaml`

Documentation releases are deployed to GitHub Pages through [`.github/workflows/docs-release.yml`](./.github/workflows/docs-release.yml).

For forks, enable GitHub Pages with **Source: GitHub Actions** in the repository settings. The workflow builds the docs with the correct base path for `https://OWNER.github.io/REPO/`.

---

## Prerequisites

- Node.js 24 LTS managed with `nvm` for local development
- Docker and Docker Compose v2+
- A Cloudflare Tunnel (or any reverse proxy) pointing to the configured host port
- API credentials for each integration you want to enable (all optional)

---

## Quick start

### 1. Clone and configure

```bash
git clone https://github.com/fjbatresv/daily-portal.git
cd daily-portal
cp .env.example .env
```

Edit `.env` with your credentials. At minimum set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to receive the morning digest.

For local development, install dependencies from the repository root:

```bash
source ~/.nvm/nvm.sh
nvm use
npm install
```

### 2. Start (without nginx)

```bash
docker compose up -d
```

The portal will be available at `http://localhost:8090` (or whatever `HOST_PORT` you set).

### 3. Start (with nginx)

```bash
docker compose --profile nginx up -d
```

In this mode, nginx serves the Angular frontend and proxies `/api/*` to NestJS.

---

## Environment variables

| Variable               | Required | Description                                                                        |
| ---------------------- | -------- | ---------------------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`   | Yes      | Bot token from [@BotFather](https://t.me/BotFather)                                |
| `TELEGRAM_CHAT_ID`     | Yes      | Your personal chat ID                                                              |
| `MORNING_DIGEST_CRON`  | No       | Cron expression (default: `0 8 * * *`)                                             |
| `TZ`                   | No       | Timezone (default: `America/Guatemala`)                                            |
| `HOST_PORT`            | No       | Port exposed to host (default: `8090`)                                             |
| `SERVE_STATIC`         | No       | `true` = NestJS serves Angular; `false` = nginx (default: `true`)                  |
| `JIRA_BASE_URL`        | No       | e.g. `https://your-org.atlassian.net`                                              |
| `JIRA_EMAIL`           | No       | Atlassian account email                                                            |
| `JIRA_API_TOKEN`       | No       | [Atlassian API token](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_PROJECT_KEY`     | No       | e.g. `TEMP`                                                                        |
| `GITHUB_TOKEN`         | No       | Personal access token (scopes: `repo`, `read:user`)                                |
| `GITHUB_USERNAME`      | No       | Your GitHub username                                                               |
| `GOOGLE_CLIENT_ID`     | No       | OAuth2 client ID                                                                   |
| `GOOGLE_CLIENT_SECRET` | No       | OAuth2 client secret                                                               |
| `GOOGLE_REFRESH_TOKEN` | No       | OAuth2 refresh token                                                               |
| `GOOGLE_CALENDAR_IDS`  | No       | Comma-separated calendar IDs (e.g. `primary,work@group.calendar.google.com`)       |
| `SLACK_USER_TOKEN`     | No       | User OAuth Token (`xoxp-...`)                                                      |
| `SLACK_USER_ID`        | No       | Your Slack member ID                                                               |

See `.env.example` for the full list with comments.

---

## Deployment on Raspberry Pi

This project is designed to run on a Raspberry Pi (aarch64), but it also works on a regular Linux Docker host. The Docker image is built multi-stage and embeds the Angular SPA inside the NestJS image, so the default mode does not need a separate frontend container.

Tested on:

- Raspberry Pi 4/5 (8 GB RAM)
- Debian 13 (trixie)
- Docker 29.x

After cloning, make sure your user is in the `docker` group:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

SQLite data persists in `./data/portal.db` (volume-mounted). Cloudflare Tunnel should point to `localhost:${HOST_PORT}`.

The default homelab mode is:

```bash
SERVE_STATIC=true
HOST_PORT=8090
docker compose up -d --build
```

Point your reverse proxy or Cloudflare Tunnel to `http://localhost:8090`.

---

## Project structure

```
daily-portal/
├── AGENTS.md                    ← instructions for AI coding agents
├── PLAN.md                      ← phased implementation plan
├── openapi.yaml                 ← REST API spec
├── daily-portal-architecture.md ← C4 + UML diagrams
├── docs-site/                   ← Astro Starlight documentation portal
├── docs/
│   ├── adr/                     ← architecture decision records
│   ├── layout.md                ← UI layout spec
│   ├── design-tokens.md         ← Aurora color system
│   └── modules/                 ← per-module implementation specs
├── db/
│   └── schema.sql
├── backend/                     ← NestJS API
├── frontend/                    ← Angular SPA
├── nginx/
│   └── nginx.conf
└── docker-compose.yml
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

If you discover a security vulnerability, please read [SECURITY.md](./SECURITY.md) before opening an issue.

## License

[MIT](./LICENSE) © Javier Batres
