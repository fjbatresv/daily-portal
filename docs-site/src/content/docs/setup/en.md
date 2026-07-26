---
title: Local Setup
description: Local development guide in English.
---

## Prerequisites

- Node.js 24 LTS managed by `nvm`.
- npm 10 or newer.
- Docker and Docker Compose for production-mode validation.
- Jira, GitHub, Google Calendar, Slack and Telegram credentials only when testing real integrations.

## Installation

From the repository root:

```bash
source ~/.nvm/nvm.sh
nvm use
npm install
```

Copy the environment template:

```bash
cp .env.example .env
```

Fill `.env` with local values. Never commit real secrets.

## Local Run

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
