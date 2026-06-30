# AGENTS.md — Daily Portal

Instrucciones para agentes de código (Codex, Copilot Workspace, Claude Code, etc.).
Lee este archivo completo antes de escribir cualquier código.

---

## Qué es este proyecto

Portal web personal desplegado en una Raspberry Pi (Debian 13, aarch64) vía Docker Compose.
Agrega tareas de Jira, PRs de GitHub, eventos de Google Calendar y menciones de Slack,
genera una lista TODO diaria y la envía por Telegram a las 8 AM.

El usuario accede al portal desde internet mediante Cloudflare Tunnel → puerto **8090** del host.

---

## Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Backend | NestJS | 11.x |
| Runtime | Node.js | 24 LTS |
| Frontend | Angular | 22.x (standalone components) |
| Base de datos | SQLite | via `better-sqlite3` (sin ORM) |
| Cache | Redis | 8 alpine |
| Contenedores | Docker Compose | v5.x |
| Lenguaje | TypeScript | 5.x estricto |

---

## Reglas de código — OBLIGATORIAS

1. **TypeScript estricto.** `strict: true` en tsconfig. Sin `any` implícito. Sin `as any` salvo casos extremos documentados.
2. **Sin ORM.** SQLite se accede con `better-sqlite3` directamente. Queries en archivos `*.repository.ts`.
3. **Sin clases de dominio.** Solo interfaces TypeScript para tipos de datos (`*.types.ts`).
4. **Inyección de dependencias NestJS** para todos los servicios. No instanciar servicios con `new` fuera de tests.
5. **Variables de entorno** solo se leen en `src/config/configuration.ts`. Nunca `process.env.X` directo en servicios.
6. **Errores de integraciones externas** no deben romper el digest. Usar `Promise.allSettled` y devolver array vacío en caso de fallo con log de error.
7. **Cache obligatorio** en todos los módulos de integración. Usar `CacheService` antes de llamar a cualquier API externa.
8. **Sin `console.log`.** Usar el logger de NestJS: `this.logger = new Logger(NombreClase.name)`.
9. **Barrel exports** en cada módulo (`index.ts`).
10. **Tests unitarios** para cada Service con Jest. Mockear dependencias externas.
11. **Coverage unitario mínimo 80%.** Cada cambio debe mantener al menos 80% de cobertura global en unit tests (`statements`, `branches`, `functions` y `lines`) para el área afectada.
12. **Coverage de docstrings mínimo 80%.** Al menos 80% de clases, servicios, controladores, funciones y métodos exportados o públicos deben tener docstrings útiles que expliquen intención, entradas/salidas o comportamiento relevante.

---

## Estructura del proyecto

```
daily-portal/
├── AGENTS.md                    ← este archivo
├── openapi.yaml                 ← spec del API REST
├── docker-compose.yml           ← build context: raíz del repo (.)
├── docker-compose.nginx-override.yml
├── .env.example
├── .gitignore                   ← ignorar data/, node_modules/, dist/
├── data/                        ← volumen SQLite (gitignored)
│   └── portal.db
├── db/
│   └── schema.sql
├── nginx/
│   └── nginx.conf               ← solo para el perfil nginx
├── docs/
│   └── modules/
│       ├── 01-jira.md
│       ├── 02-github.md
│       ├── 03-google-calendar.md
│       ├── 04-slack.md
│       ├── 05-telegram.md
│       ├── 06-reminders.md
│       ├── 07-scheduler.md
│       └── 08-daily-aggregator.md
│
├── backend/                     ← NestJS API
│   ├── Dockerfile               ← multi-stage: Angular + NestJS, build context=raíz
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts
│       ├── app.module.ts        ← importa ServeStaticModule si SERVE_STATIC=true
│       ├── config/
│       │   └── configuration.ts
│       ├── common/
│       │   ├── database/
│       │   │   ├── database.module.ts
│       │   │   └── database.service.ts   ← better-sqlite3, init schema
│       │   ├── cache/
│       │   │   ├── cache.module.ts
│       │   │   └── cache.service.ts
│       │   ├── utils/
│       │   │   └── reminder-priority.util.ts  ← getEffectivePriority(), getDaysPending()
│       │   └── types/
│       │       └── daily-digest.types.ts
│       ├── dashboard/
│       │   ├── dashboard.module.ts
│       │   ├── dashboard.controller.ts
│       │   └── daily-aggregator.service.ts
│       ├── integrations/
│       │   ├── jira/
│       │   ├── github/
│       │   ├── google-calendar/
│       │   ├── slack/
│       │   └── clickup/         ← creado pero NO importado en AppModule
│       ├── reminders/
│       ├── telegram/
│       └── scheduler/
│
└── frontend/                    ← Angular SPA (sin Dockerfile propio)
    ├── package.json
    ├── angular.json
    └── src/
        ├── main.ts
        └── app/
            ├── app.routes.ts
            ├── app.config.ts
            ├── core/
            │   ├── services/
            │   │   ├── dashboard.service.ts
            │   │   └── reminders.service.ts
            │   └── models/
            │       └── daily-digest.model.ts
            └── features/
                ├── dashboard/
                ├── tasks/
                ├── prs/
                ├── calendar/
                ├── slack/
                └── reminders/
```

> **No hay `frontend/Dockerfile`.** El frontend se construye dentro del `backend/Dockerfile` (multi-stage). El `build context` del servicio backend en docker-compose es la raíz del repo para acceder a ambas carpetas.

---

## Modos de despliegue

El sistema soporta dos modos controlados por variables de entorno y Docker Compose profiles.
**No hay contenedor de frontend separado.** El build de Angular siempre va embebido en la imagen del backend (multi-stage Dockerfile desde la raíz del repo).

| Variable | Valor | Efecto |
|---|---|---|
| `SERVE_STATIC` | `true` (default) | NestJS sirve Angular via `ServeStaticModule`. Backend expuesto en `HOST_PORT`. |
| `SERVE_STATIC` | `false` | NestJS solo expone `/api/*`. Nginx (perfil) sirve el frontend. |
| `HOST_PORT` | `8090` (default) | Puerto expuesto al host Docker. Cloudflare Tunnel o Caddy apuntan aquí. |

### Modos de arranque

```bash
# Modo sin nginx (default — para uso con Caddy o Cloudflare Tunnel)
docker compose up -d

# Modo con nginx (standalone, sin proxy externo)
docker compose --profile nginx up -d
```

### ServeStaticModule en NestJS

```typescript
// app.module.ts
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

const imports: any[] = [
  ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
  // ...resto de módulos
];

// Solo activar si SERVE_STATIC=true
if (process.env.SERVE_STATIC === 'true') {
  imports.unshift(
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),  // Angular dist embebido
      exclude: ['/api/(.*)'],                      // no interceptar rutas de API
    }),
  );
}

@Module({ imports })
export class AppModule {}
```

Instalar: `npm install @nestjs/serve-static`

### Estructura del Dockerfile (multi-stage desde raíz)

El `backend/Dockerfile` tiene acceso al directorio `frontend/` porque el build context es la raíz del repo (`.`):

```
# En docker-compose.yml:
backend:
  build:
    context: .               ← raíz del repo
    dockerfile: backend/Dockerfile
```

Stages:
1. `frontend-builder` → `npm run build` del Angular app → `/frontend/dist/`
2. `backend-builder` → `npm run build` del NestJS → `/app/dist/`
3. `final` → copia ambos. Angular queda en `/app/public/`

---

## Variables de entorno

Definidas en `.env` (ver `.env.example`). Se acceden **únicamente** a través de `ConfigService` de `@nestjs/config`.

```typescript
// src/config/configuration.ts
export default () => ({
  sqlite: {
    path: process.env.SQLITE_PATH ?? '/app/data/portal.db',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://redis:6379',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  jira: {
    baseUrl: process.env.JIRA_BASE_URL,
    email: process.env.JIRA_EMAIL,
    apiToken: process.env.JIRA_API_TOKEN,
    projectKey: process.env.JIRA_PROJECT_KEY,
  },
  github: {
    token: process.env.GITHUB_TOKEN,
    username: process.env.GITHUB_USERNAME,
  },
  googleCalendar: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    calendarIds: (process.env.GOOGLE_CALENDAR_IDS ?? 'primary').split(','),
  },
  slack: {
    userToken: process.env.SLACK_USER_TOKEN,
    userId: process.env.SLACK_USER_ID,
  },
  scheduler: {
    cron: process.env.MORNING_DIGEST_CRON ?? '0 8 * * *',
    timezone: process.env.TZ ?? 'America/Guatemala',
  },
});
```

---

## Tipos centrales

Definidos en `src/common/types/daily-digest.types.ts`. No duplicar en módulos individuales.

```typescript
export type Priority = 'high' | 'medium' | 'low';
export type PRStatus = 'open' | 'merged' | 'closed' | 'draft';
export type CheckStatus = 'success' | 'failure' | 'pending' | 'error';

export interface JiraTask {
  id: string;
  key: string;           // e.g. TEMP-123
  summary: string;
  status: string;
  priority: string;
  url: string;
}

export interface GitHubPR {
  id: number;
  title: string;
  url: string;
  repo: string;
  status: PRStatus;
  isDraft: boolean;
  hasNewComments: boolean;
  checkStatus: CheckStatus;
  hasConflicts: boolean;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;     // ISO datetime
  endTime: string;
  calendarId: string;
  calendarName: string;
  isAllDay: boolean;
  meetUrl?: string;
}

export interface SlackMention {
  ts: string;
  channelName: string;
  senderName: string;
  text: string;
  permalink: string;
}

export interface Reminder {
  id: string;
  text: string;
  date: string;          // YYYY-MM-DD
  priority: Priority;
  completed: boolean;
  createdAt: string;
}

export interface TodoItem {
  source: 'jira' | 'github' | 'calendar' | 'slack' | 'reminder';
  priority: Priority;
  text: string;
  url?: string;
  dueTime?: string;
}

export interface DailyDigest {
  date: string;
  todoList: TodoItem[];
  tasks: JiraTask[];
  prs: GitHubPR[];
  events: CalendarEvent[];
  slackMentions: SlackMention[];
  reminders: Reminder[];
  generatedAt: string;   // ISO datetime
}

// Resultado de una integración que puede fallar sin romper el digest
export interface IntegrationResult<T> {
  data: T[];
  error?: string;
}
```

---

## CacheService

`src/common/cache/cache.service.ts` — wrapper de ioredis con TTL por clave.

```typescript
// Interfaz que deben usar los módulos de integración
export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}
```

Regla: **todos los métodos de integración** deben llamar `cache.get()` primero. Si hay hit, retornar. Si hay miss, llamar la API y hacer `cache.set()`.

---

## AppModule — integraciones registradas

```typescript
// src/app.module.ts
// ClickUpModule NO está en imports. Crear el módulo pero no importarlo aquí.
@Module({
  imports: [
    ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
    CacheModule,
    DatabaseModule,     // inicializa SQLite y crea schema
    DashboardModule,
    JiraModule,
    GitHubModule,
    GoogleCalendarModule,
    SlackModule,
    RemindersModule,
    TelegramModule,
    SchedulerModule,
    // ClickUpModule  ← comentado intencionalmente
  ],
})
export class AppModule {}
```

---

## Módulos — resumen de responsabilidades

| Módulo | Lee de | Escribe en | Cache TTL |
|---|---|---|---|
| JiraModule | Jira REST API | — | 15 min |
| GitHubModule | GitHub GraphQL | — | 5 min |
| GoogleCalendarModule | Google Calendar API v3 | — | 10 min |
| SlackModule | Slack Web API (xoxp-) | — | 5 min |
| RemindersModule | SQLite | SQLite | sin cache |
| TelegramModule | — | Telegram Bot API, SQLite (logs) | — |
| SchedulerModule | — (llama Aggregator) | — | — |
| DailyAggregatorService | todos los módulos | — | — |
| ClickUpModule | ClickUp API | — | 15 min |

Ver specs detalladas en `docs/modules/`.

---

## Layout y comportamiento de la UI

Spec completa en `docs/layout.md`. Resumen operativo:

### Estructura de tabs

```
Header (siempre visible): logo · fecha · "+ Recordatorio" · Refrescar · Toggle tema
Tab Hoy:     lista TODO con checkboxes, summary chips al tope
Tab Fuentes: secciones por integración (Jira, GitHub, Calendar, Slack, Recordatorios)
```

### Botón "Crear recordatorio"

Dos puntos de entrada que abren el mismo formulario en el tab Fuentes:
- **Header global** → botón "+ Recordatorio" (siempre visible, abre tab Fuentes si el usuario está en Hoy)
- **Sección Recordatorios** → botón "+ Nuevo" en el header de la sección

El formulario tiene: texto (required, maxLength 500), fecha (default: mañana), prioridad inicial (default: media).

### Comportamiento "marcar como atendido"

En el tab Hoy, cada ítem tiene un checkbox. El comportamiento varía según la fuente:

| Fuente | Efecto en backend |
|---|---|
| `reminder` | `PATCH /api/reminders/:id/complete` → persiste en SQLite |
| `jira`, `github`, `calendar`, `slack` | Solo estado visual (session-only, no llamada al backend) |

El frontend guarda los IDs de ítems no-reminder atendidos en `localStorage` con key `portal:acknowledged:{YYYY-MM-DD}`. Se limpia automáticamente al día siguiente (comparar fecha al cargar).

Al marcar un ítem:
1. Ítem recibe `line-through` + `opacity: 0.4`
2. Se mueve al fondo de la lista (sección "N atendidos")
3. El badge de conteo del tab decrementa
4. Se puede desmarcar desde la sección de atendidos

### Escalación de prioridad (reminders)

La prioridad stored en DB no se modifica. `getEffectivePriority()` en `src/common/utils/reminder-priority.util.ts` calcula la prioridad real según días pendientes. Ver algoritmo completo en `docs/modules/06-reminders.md`.

### Estado Angular (signals, sin NgRx)

```typescript
// frontend/src/app/features/dashboard/dashboard.store.ts
export class DashboardStore {
  digest      = signal<DailyDigest | null>(null);
  loading     = signal(false);
  activeTab   = signal<'hoy' | 'fuentes'>('hoy');
  acknowledged = signal<Set<string>>(new Set());  // localStorage:portal:acknowledged:{date}
}
```

### Estructura de componentes Angular (actualizada)

```
features/
├── dashboard/
│   ├── dashboard.component.ts     ← shell + header + tabs
│   └── summary-chips.component.ts
├── todo/
│   ├── todo-list.component.ts     ← lista con sección "atendidos"
│   └── todo-item.component.ts     ← checkbox + badge fuente + metadata
└── sources/
    ├── sources.component.ts
    ├── jira-section.component.ts
    ├── github-section.component.ts
    ├── calendar-section.component.ts
    ├── slack-section.component.ts
    └── reminders-section/
        ├── reminders-section.component.ts
        ├── reminder-item.component.ts  ← badge escalación + subtexto "hace N días"
        └── reminder-form.component.ts  ← formulario crear
```

---

## Sistema de diseño — Aurora

Spec completa en `docs/design-tokens.md`. Resumen operativo:

**Paleta:** violeta + sky blue. Dark mode por defecto, light mode disponible.
**Tokens:** CSS custom properties en `src/styles/globals.scss`. Nunca hardcodear colores.
**Toggle:** `ThemeService` (signal) + `data-theme` attribute en `<html>`. Persiste en `localStorage`.
**Tailwind:** todos los tokens mapeados como clases `aurora-*`, `status-*`, `integration-*`.

### Archivos a crear

```
frontend/src/styles/
├── globals.scss          ← CSS custom properties (dark + light), importado en angular.json
└── tailwind.config.js    ← en raíz del frontend

frontend/src/app/core/services/
└── theme.service.ts      ← ThemeService con signal + localStorage
```

### Reglas de uso en componentes

```html
<!-- ✅ Siempre tokens -->
<div class="bg-aurora-surface border border-aurora-border rounded-lg">

<!-- ❌ Nunca hardcode -->
<div style="background: #1E1830">
```

Colores semánticos por caso de uso:
- PR con error / prioridad alta → `--color-error` / `--color-error-muted`
- PR con warning / prioridad media → `--color-warning` / `--color-warning-muted`
- Jira → `--color-jira` (= primary violeta)
- GitHub → `--color-github` (neutro)
- Calendar → `--color-calendar` (= accent sky)
- Slack → `--color-slack` (violeta rosado)

---

## Frontend — Angular

- **Standalone components** únicamente. Sin NgModules.
- **HttpClient** con `provideHttpClient()` en `app.config.ts`.
- **Signals** para estado local. Sin NgRx.
- **TailwindCSS** para estilos.
- Un servicio `DashboardService` en `core/services/` que llama a `GET /api/dashboard`.
- Un servicio `RemindersService` en `core/services/` para CRUD de recordatorios.
- El dashboard se **auto-refresca cada 5 minutos** con `interval(300_000)` + `switchMap`.

---

## Comandos de desarrollo

```bash
# Backend
cd backend
npm install
npm run start:dev       # watch mode

# Frontend
cd frontend
npm install
ng serve               # http://localhost:4200

# Docker (producción en RPi)
docker compose up -d --build

# Migraciones SQLite (solo primer boot)
# Se ejecutan automáticamente via DatabaseModule al iniciar
```

---

## Orden de implementación sugerido para Codex

Implementar en este orden para poder validar end-to-end cuanto antes:

1. `DatabaseModule` + `CacheModule` + `ConfigModule` (infraestructura base)
2. `RemindersModule` (CRUD simple, sin integraciones externas)
3. `TelegramModule` (enviar mensaje de prueba)
4. `SchedulerModule` (triggear a las 8 AM)
5. `JiraModule` (primera integración externa)
6. `GitHubModule`
7. `GoogleCalendarModule`
8. `SlackModule`
9. `DailyAggregatorService` (une todo)
10. `DashboardController` (expone el API)
11. Angular frontend

---

## Referencia de specs por módulo

| Archivo | Módulo |
|---|---|
| `docs/modules/01-jira.md` | JiraModule |
| `docs/modules/02-github.md` | GitHubModule |
| `docs/modules/03-google-calendar.md` | GoogleCalendarModule |
| `docs/modules/04-slack.md` | SlackModule |
| `docs/modules/05-telegram.md` | TelegramModule |
| `docs/modules/06-reminders.md` | RemindersModule |
| `docs/modules/07-scheduler.md` | SchedulerModule |
| `docs/modules/08-daily-aggregator.md` | DailyAggregatorService |

Spec del API REST: `openapi.yaml`
Arquitectura completa: `daily-portal-architecture.md`
Layout y comportamiento UI: `docs/layout.md`
Tokens de diseño: `docs/design-tokens.md`

## Imported Claude Cowork project instructions


<claude-mem-context>
# Memory Context

# [Personal StandUP] recent context, 2026-06-29 11:43pm CST

No previous sessions found.
</claude-mem-context>
