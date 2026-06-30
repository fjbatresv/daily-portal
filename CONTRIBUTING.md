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

- Node.js 24 LTS
- Docker + Docker Compose v2
- Redis (or use the Docker Compose setup)

### Backend

```bash
cd backend
npm install
cp ../.env.example ../.env   # fill in your credentials
npm run start:dev
```

API runs at `http://localhost:3000`.

### Frontend

```bash
cd frontend
npm install
ng serve
```

Dev server runs at `http://localhost:4200`, proxied to the backend.

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
3. Make sure `npm run build` passes for both backend and frontend
4. Run tests: `npm test` in the `backend/` directory
5. Open a PR against `main` with a clear description of what changed and why

---

## Adding a new integration

1. Create the module in `backend/src/integrations/{name}/`
2. Write a spec in `docs/modules/{N}-{name}.md` following the existing format
3. Add it to `AppModule` imports (unless it should be opt-in like ClickUp)
4. Update `DailyAggregatorService` to include the new data in the digest
5. Add a section in the Angular frontend (tab Fuentes)

---

## Reporting bugs

Use the [Bug Report template](https://github.com/fjbatresv/daily-portal/issues/new?template=bug_report.md). Include:
- What you expected vs. what happened
- Steps to reproduce
- Your OS, Docker version, and relevant `.env` settings (never paste actual API tokens)

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
