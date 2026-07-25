# Contributing to Daily Portal

Thanks for your interest in contributing. This is a personal project but PRs and issues are welcome.

---

## Before you start

- Read [`AGENTS.md`](./AGENTS.md) — it describes the architecture, coding rules, and module structure.
- Check the [open issues](https://github.com/fjbatresv/daily-portal/issues) to avoid duplicate work.
- For significant changes, open an issue first to discuss what you'd like to change.

---

## Development setup

### Requirements

- Node.js 24 LTS managed with `nvm`
- Docker + Docker Compose v2
- Redis (or use the Docker Compose setup)

Install dependencies from the repository root:

```bash
source ~/.nvm/nvm.sh
nvm use
npm install
cp .env.example .env # fill in your credentials
```

### Backend

```bash
cd backend
source ~/.nvm/nvm.sh
nvm use
npm run start:dev
```

API runs at `http://localhost:3000`.

### Frontend

```bash
cd frontend
source ~/.nvm/nvm.sh
nvm use
npm run start
```

Dev server runs at `http://localhost:4200`, proxied to the backend.

### Documentation

```bash
source ~/.nvm/nvm.sh
nvm use
npm run docs:dev
npm run docs:check
```

The documentation portal is in `docs-site/`. Compodoc, TypeDoc, and the OpenAPI reference are generated during `npm run docs:build`.

If you maintain a fork, enable GitHub Pages with **Source: GitHub Actions** to publish documentation from the `Documentation Release` workflow.

---

## Coding rules (summary)

The full list is in `AGENTS.md §Reglas de código`. Key points:

- TypeScript strict mode — no implicit `any`
- No ORM — SQLite queries in `*.repository.ts` via `better-sqlite3`
- All env vars through `ConfigService`, never `process.env.X` directly in services
- Cache all external API calls — use `CacheService` before every HTTP call
- No `console.log` — use `new Logger(ClassName.name)` from NestJS
- Angular: standalone components only, signals for state, no NgRx, no hardcoded colors

---

## Pull requests

1. Fork the repo and create a branch from `main`
2. Name your branch: `feat/short-description`, `fix/short-description`, or `docs/short-description`
3. Run `npm run format:check`
4. Run `npm run docstrings:check`
5. Run `npm run lint`
6. Run `npm run test`
7. Run `npm run build`
8. Run `npm run docs:check`
9. For broader changes, run `npm run ci`
10. If you changed public behavior, update `openapi.yaml`, `README.md`, `docs-site/`, or the relevant file under `docs/`
11. Open a PR against `main` with a clear description of what changed and why
12. When opening a PR that completes a task from `PLAN.md`, mark that task as done by striking through its number and title in `PLAN.md`

## Architecture changes

Use [`docs/adr/`](./docs/adr/) for decisions that affect deployment topology, persistence, public APIs, integration boundaries, security posture, or long-term maintenance.

For a new decision:

1. Copy the style of the existing ADRs.
2. Mark the status as `Proposed` while discussion is open.
3. Link the ADR from `docs/adr/README.md`.
4. Update the Starlight docs if the decision affects setup, operation, or contribution workflows.

---

## Adding a new integration

1. Create the module in `backend/src/integrations/{name}/`
2. Write a spec in `docs/modules/{N}-{name}.md` following the existing format
3. Add it to `AppModule` imports (unless it should be opt-in like ClickUp)
4. Update `DailyAggregatorService` to include the new data in the digest
5. Add a section in the Angular frontend (tab Fuentes)
6. Update `openapi.yaml`, frontend models, and documentation when the integration changes API payloads

---

## Reporting bugs

Use the [Bug Report template](https://github.com/fjbatresv/daily-portal/issues/new?template=bug_report.md). Include:

- What you expected vs. what happened
- Steps to reproduce
- Your OS, Docker version, and relevant `.env` settings (never paste actual API tokens)

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
