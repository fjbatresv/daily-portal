# Daily Portal

A self-hosted personal dashboard that aggregates your daily tasks from multiple sources and sends a morning briefing via Telegram.

Runs containerized on a Raspberry Pi, exposed via Cloudflare Tunnel. Built with NestJS + Angular.

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

| Layer | Technology |
|---|---|
| Backend | NestJS 11.x |
| Frontend | Angular 22.x (standalone, signals) |
| Database | SQLite via `better-sqlite3` |
| Cache | Redis 8 |
| Runtime | Node.js 24 LTS |
| Containers | Docker Compose v5 |
| Reverse proxy | nginx (optional profile) |

---

## Architecture

See [`daily-portal-architecture.md`](./daily-portal-architecture.md) for C4 diagrams (L1/L2/L3), UML sequence diagrams and infrastructure layout.

The full REST API spec is in [`openapi.yaml`](./openapi.yaml).

---

## Prerequisites

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

| Variable | Required | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_ID` | Yes | Your personal chat ID |
| `MORNING_DIGEST_CRON` | No | Cron expression (default: `0 8 * * *`) |
| `TZ` | No | Timezone (default: `America/Guatemala`) |
| `HOST_PORT` | No | Port exposed to host (default: `8090`) |
| `SERVE_STATIC` | No | `true` = NestJS serves Angular; `false` = nginx (default: `true`) |
| `JIRA_BASE_URL` | No | e.g. `https://your-org.atlassian.net` |
| `JIRA_EMAIL` | No | Atlassian account email |
| `JIRA_API_TOKEN` | No | [Atlassian API token](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_PROJECT_KEY` | No | e.g. `TEMP` |
| `GITHUB_TOKEN` | No | Personal access token (scopes: `repo`, `read:user`) |
| `GITHUB_USERNAME` | No | Your GitHub username |
| `GOOGLE_CLIENT_ID` | No | OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | No | OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | No | OAuth2 refresh token |
| `GOOGLE_CALENDAR_IDS` | No | Comma-separated calendar IDs (e.g. `primary,work@group.calendar.google.com`) |
| `SLACK_USER_TOKEN` | No | User OAuth Token (`xoxp-...`) |
| `SLACK_USER_ID` | No | Your Slack member ID |

See `.env.example` for the full list with comments.

---

## Deployment on Raspberry Pi

This project is designed to run on a Raspberry Pi (aarch64). The Docker image is built multi-stage and embeds the Angular SPA inside the NestJS image — no separate frontend container.

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

---

## Project structure

```
daily-portal/
├── AGENTS.md                    ← instructions for AI coding agents
├── PLAN.md                      ← phased implementation plan
├── openapi.yaml                 ← REST API spec
├── daily-portal-architecture.md ← C4 + UML diagrams
├── docs/
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
