# PLAN.md — Plan de implementación para Codex

Plan de trabajo para construir el Daily Portal de forma incremental.
Cada fase produce código funcional y testeable antes de avanzar a la siguiente.

**Lee `AGENTS.md` completo antes de empezar cualquier task.**

---

## Índice de fases

| Fase | Nombre | Tasks |
|---|---|---|
| 1 | Infraestructura base | T01–T04 |
| 2 | Módulos core (sin red) | T05–T07 |
| 3 | Integraciones externas | T08–T11 |
| 4 | Agregación y API | T12 |
| 5 | Frontend Angular | T13–T18 |
| 6 | Docker y despliegue | T19–T20 |

---

## Fase 1 — Infraestructura base

### T01 · Scaffolding del proyecto

**Objetivo:** Crear la estructura de carpetas completa y los archivos de configuración raíz.

**Archivos a crear:**
- `backend/package.json` — dependencias NestJS 11.x + better-sqlite3 + ioredis + googleapis + class-validator + date-fns
- `backend/tsconfig.json` — strict: true, target: ES2022, decorators habilitados
- `backend/src/main.ts` — bootstrap NestJS en el puerto 3000 + `ValidationPipe({ whitelist: true })`
- `backend/src/app.module.ts` — AppModule vacío por ahora (módulos se agregan en tasks siguientes). **ServeStaticModule si SERVE_STATIC=true.**
- `frontend/package.json` — Angular 22.x + TailwindCSS + tabler-icons
- `frontend/angular.json` — outputPath: `../backend/dist/public`
- `frontend/tailwind.config.js` — tokens Aurora (ver `docs/design-tokens.md`)
- `frontend/src/styles/globals.scss` — CSS custom properties dark/light (copiar de `docs/design-tokens.md`)
- `.env.example` — todas las variables de `src/config/configuration.ts`
- `.gitignore` — ignorar `data/`, `node_modules/`, `dist/`, `.env`
- `db/schema.sql` — schema completo (tablas `reminders` + `notification_logs`)

**Referencias:** `AGENTS.md` §Stack, §Estructura del proyecto, §Variables de entorno; `docs/design-tokens.md`

**Criterios de aceptación:**
- `cd backend && npm install && npm run build` termina sin errores
- `cd frontend && npm install && ng build` produce output en `backend/dist/public/`
- `npm run start:dev` levanta NestJS en el puerto 3000 y responde `{"status":"ok"}` en alguna ruta de prueba

---

### T02 · DatabaseModule

**Objetivo:** Módulo de base de datos con better-sqlite3, modo WAL y migración automática del schema.

**Archivos a crear:**
- `backend/src/common/database/database.module.ts`
- `backend/src/common/database/database.service.ts`
- `backend/src/common/database/index.ts`

**Referencias:** `docs/modules/06-reminders.md` §DatabaseModule / DatabaseService

**Criterios de aceptación:**
- Al iniciar NestJS, la tabla `reminders` existe en `SQLITE_PATH`
- El archivo DB se crea si no existe
- `pragma journal_mode` retorna `wal` al conectarse

---

### T03 · CacheModule

**Objetivo:** Wrapper de Redis con métodos `get`, `set`, `del` y TTL configurable por clave.

**Archivos a crear:**
- `backend/src/common/cache/cache.module.ts`
- `backend/src/common/cache/cache.service.ts`
- `backend/src/common/cache/index.ts`

**Referencias:** `AGENTS.md` §CacheService

**Criterios de aceptación:**
- `cache.set('test', { ok: true }, 5)` persiste el valor en Redis
- `cache.get('test')` retorna el objeto antes de expirar, `null` después
- `cache.del('test')` elimina la clave

---

### T04 · ConfigModule y tipos centrales

**Objetivo:** Configuración centralizada + interfaces TypeScript del dominio.

**Archivos a crear:**
- `backend/src/config/configuration.ts` — función que mapea `process.env` a objeto tipado
- `backend/src/common/types/daily-digest.types.ts` — interfaces `JiraTask`, `GitHubPR`, `CalendarEvent`, `SlackMention`, `Reminder`, `TodoItem`, `DailyDigest`, `Priority`, `PRStatus`, `CheckStatus`
- `backend/src/common/utils/reminder-priority.util.ts` — `getEffectivePriority()` + `getDaysPending()`

**Referencias:** `AGENTS.md` §Tipos centrales, §Variables de entorno; `docs/modules/06-reminders.md` §Escalación de prioridad dinámica

**Criterios de aceptación:**
- `ConfigService.get('sqlite.path')` retorna el valor de `SQLITE_PATH`
- Tests unitarios de `getEffectivePriority`:
  - low + 1 día → low
  - low + 2 días → medium
  - low + 5 días → high
  - medium + 3 días → high
  - high + 10 días → high
  - fecha futura → prioridad original

---

## Fase 2 — Módulos core (sin red)

### T05 · RemindersModule

**Objetivo:** CRUD completo de recordatorios sobre SQLite.

**Archivos a crear:**
- `backend/src/reminders/reminders.module.ts`
- `backend/src/reminders/reminders.controller.ts`
- `backend/src/reminders/reminders.service.ts`
- `backend/src/reminders/reminders.repository.ts`
- `backend/src/reminders/create-reminder.dto.ts`
- `backend/src/reminders/update-reminder.dto.ts`
- `backend/src/reminders/index.ts`

**Referencias:** `docs/modules/06-reminders.md`; `openapi.yaml` §/api/reminders

**Criterios de aceptación:**
- `POST /api/reminders` con body válido → 201 + objeto Reminder
- `GET /api/reminders` → array de reminders (vacío si no hay)
- `GET /api/reminders/:id` de uno existente → 200; de uno inexistente → 404
- `PATCH /api/reminders/:id` → actualiza campos enviados
- `PATCH /api/reminders/:id/complete` → `completed: true`
- `DELETE /api/reminders/:id` → 204; inexistente → 404
- La respuesta incluye `daysOverdue` y `escalatedPriority` calculados
- DTO con `text` vacío → 400 con mensaje de validación
- DTO con `date` mal formateada → 400

---

### T06 · TelegramModule

**Objetivo:** Enviar mensajes por Telegram con formato MarkdownV2 y registrar notificaciones en SQLite.

**Archivos a crear:**
- `backend/src/telegram/telegram.module.ts`
- `backend/src/telegram/telegram.service.ts`
- `backend/src/telegram/telegram-formatter.service.ts`
- `backend/src/telegram/index.ts`

**También:**
- Agregar tabla `notification_logs` al schema (`db/schema.sql`)

**Referencias:** `docs/modules/05-telegram.md`

**Criterios de aceptación:**
- `TelegramService.sendDailyDigest(digest)` llama a `POST /bot{token}/sendMessage` con `parse_mode: MarkdownV2`
- Caracteres especiales de MarkdownV2 (`_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`) son escapados correctamente
- Se inserta un registro en `notification_logs` con `sent_at` y `status`
- Si Telegram falla, se loguea el error pero no se lanza excepción (no rompe el flujo)
- Test unitario: `TelegramFormatter` formatea correctamente un `DailyDigest` de ejemplo

---

### T07 · SchedulerModule

**Objetivo:** Cron a las 8 AM (configurable) que dispara el digest diario.

**Archivos a crear:**
- `backend/src/scheduler/scheduler.module.ts`
- `backend/src/scheduler/scheduler.service.ts`
- `backend/src/scheduler/index.ts`

**Referencias:** `docs/modules/07-scheduler.md`

**Criterios de aceptación:**
- El cron usa la expresión de `MORNING_DIGEST_CRON` (default `0 8 * * *`)
- El cron usa `process.env.MORNING_DIGEST_CRON` directamente (excepción documentada a la regla de ConfigService)
- Envuelve la ejecución en try/catch → errores logueados, no propagados
- El endpoint `POST /api/scheduler/trigger` dispara el digest manualmente (solo en dev)

---

## Fase 3 — Integraciones externas

> Cada integración sigue el mismo patrón: **1) verificar cache → 2) llamar API → 3) guardar en cache → 4) retornar datos**.
> Ante cualquier error (401, 429, timeout, etc.), retornar `[]` y loguear.

---

### T08 · JiraModule

**Objetivo:** Obtener tareas asignadas al usuario desde Jira Cloud.

**Archivos a crear:**
- `backend/src/integrations/jira/jira.module.ts`
- `backend/src/integrations/jira/jira.service.ts`
- `backend/src/integrations/jira/index.ts`

**Referencias:** `docs/modules/01-jira.md`

**Criterios de aceptación:**
- `JiraService.getTasks()` retorna `JiraTask[]`
- Usa Basic Auth con `email:apiToken` en base64 (header `Authorization: Basic ...`)
- JQL: `assignee = currentUser() AND status IN ("To Do","In Progress") ORDER BY priority DESC`
- Cache key `jira:tasks`, TTL 15 min
- Ante 401 → retorna `[]` y loguea `warn`
- Ante 429 → retorna el valor cacheado si existe, `[]` si no
- Test unitario con respuesta Jira mockeada → mapeo correcto a `JiraTask[]`

---

### T09 · GitHubModule

**Objetivo:** Obtener PRs abiertos del usuario con estado de checks, conflictos y comentarios recientes.

**Archivos a crear:**
- `backend/src/integrations/github/github.module.ts`
- `backend/src/integrations/github/github.service.ts`
- `backend/src/integrations/github/index.ts`

**Referencias:** `docs/modules/02-github.md`

**Criterios de aceptación:**
- Usa la API GraphQL de GitHub (`POST https://api.github.com/graphql`)
- `hasNewComments` es `true` si algún comentario fue creado en las últimas 24h
- Campos `hasConflicts`, `checkStatus`, `isDraft` mapeados correctamente
- Cache key `github:prs`, TTL 5 min
- Test unitario: respuesta GraphQL mockeada → mapeo correcto a `GitHubPR[]`

---

### T10 · GoogleCalendarModule

**Objetivo:** Obtener eventos del día de 2 calendarios de Google Calendar.

**Archivos a crear:**
- `backend/src/integrations/google-calendar/google-calendar.module.ts`
- `backend/src/integrations/google-calendar/google-calendar.service.ts`
- `backend/src/integrations/google-calendar/index.ts`

**Referencias:** `docs/modules/03-google-calendar.md`

**Criterios de aceptación:**
- Usa la librería `googleapis` con OAuth2 y `refresh_token`
- Fetcha los calendarios listados en `GOOGLE_CALENDAR_IDS` (separados por coma) en paralelo
- `isAllDay` detectado correctamente (evento con `date` en vez de `dateTime`)
- `meetUrl` extraído de `hangoutLink` o `conferenceData.entryPoints`
- Cache key `gcal:events`, TTL 10 min
- Test unitario: respuesta de API mockeada → mapeo correcto a `CalendarEvent[]`

---

### T11 · SlackModule

**Objetivo:** Obtener menciones del usuario en los últimos 24h usando User OAuth Token.

**Archivos a crear:**
- `backend/src/integrations/slack/slack.module.ts`
- `backend/src/integrations/slack/slack.service.ts`
- `backend/src/integrations/slack/index.ts`

**Referencias:** `docs/modules/04-slack.md`

**Criterios de aceptación:**
- Usa `GET https://slack.com/api/search.messages` con header `Authorization: Bearer xoxp-...`
- Query: `<@{SLACK_USER_ID}>` con filtro de timestamp de las últimas 24h
- Respuestas con `ok: false` → retorna `[]` y loguea el error de Slack
- Cache key `slack:mentions`, TTL 5 min
- Test unitario: respuesta mockeada → mapeo correcto a `SlackMention[]`

---

## Fase 4 — Agregación y API

### T12 · DailyAggregatorService + DashboardController

**Objetivo:** Orquestar todas las integraciones en paralelo, construir el TODO list priorizado y exponer el API REST.

**Archivos a crear:**
- `backend/src/dashboard/dashboard.module.ts`
- `backend/src/dashboard/dashboard.controller.ts`
- `backend/src/dashboard/daily-aggregator.service.ts`

**Modificar:**
- `backend/src/app.module.ts` — importar todos los módulos completados (T02–T11)

**Referencias:** `docs/modules/08-daily-aggregator.md`; `openapi.yaml` §/api/dashboard

**Criterios de aceptación:**
- `GET /api/health` → `{ status: "ok", timestamp, uptime }`
- `GET /api/dashboard` → `DailyDigest` completo con datos de todas las integraciones
- `POST /api/dashboard/refresh` → invalida cache de todas las integraciones y retorna digest fresco
- Si una integración falla, las demás siguen funcionando (usar `Promise.allSettled`)
- Los recordatorios usan `getEffectivePriority()` para el ordenamiento en `buildTodoList()`
- `todoList` ordenado: high → medium → low
- Test unitario: una integración falla → digest con esa sección vacía, resto normal
- Test unitario: `buildTodoList` con PR con conflictos → ítem high al tope

---

## Fase 5 — Frontend Angular

> Cada componente es standalone. Sin NgModules. Usar signals para estado. No usar NgRx.
> Todos los colores via tokens Aurora — nunca hardcodeados.

---

### T13 · Scaffolding Angular + ThemeService + tokens

**Objetivo:** App base con routing, ThemeService y los tokens de diseño cargados.

**Archivos a crear:**
- `frontend/src/app/app.config.ts` — `provideHttpClient()`, `provideRouter()`
- `frontend/src/app/app.routes.ts` — ruta raíz → `DashboardComponent`
- `frontend/src/app/app.component.ts` — shell mínimo que llama `theme.init()`
- `frontend/src/app/core/services/theme.service.ts` — signal + localStorage + `data-theme` attr
- `frontend/src/styles/globals.scss` — CSS custom properties dark/light (de `docs/design-tokens.md`)
- `frontend/tailwind.config.js` — tokens `aurora-*`, `status-*`, `integration-*`

**Referencias:** `docs/design-tokens.md` §Toggle de modo en Angular, §Tailwind Config

**Criterios de aceptación:**
- `ng serve` levanta sin errores
- `ThemeService.toggle()` cambia el atributo `data-theme` en `<html>`
- Al recargar, el tema persiste (localStorage)
- Las clases `bg-aurora-surface`, `text-aurora-text` aplican el color correcto en ambos modos

---

### T14 · DashboardService + RemindersService (HTTP)

**Objetivo:** Servicios Angular para comunicarse con el backend.

**Archivos a crear:**
- `frontend/src/app/core/services/dashboard.service.ts`
- `frontend/src/app/core/services/reminders.service.ts`
- `frontend/src/app/core/models/daily-digest.model.ts` — interfaces TypeScript (mirrors de backend)

**Referencias:** `openapi.yaml`; `AGENTS.md` §Frontend — Angular

**Criterios de aceptación:**
- `DashboardService.getDailyDigest()` llama a `GET /api/dashboard` y retorna `Observable<DailyDigest>`
- `DashboardService` tiene auto-refresh cada 5 minutos con `interval(300_000)` + `switchMap`
- `RemindersService.create(dto)` → `POST /api/reminders`
- `RemindersService.complete(id)` → `PATCH /api/reminders/:id/complete`
- `RemindersService.delete(id)` → `DELETE /api/reminders/:id`

---

### T15 · DashboardComponent + DashboardStore + Header + Tabs

**Objetivo:** Shell del portal con header siempre visible y dos tabs (Hoy / Fuentes).

**Archivos a crear:**
- `frontend/src/app/features/dashboard/dashboard.component.ts`
- `frontend/src/app/features/dashboard/dashboard.component.html`
- `frontend/src/app/features/dashboard/dashboard.store.ts`
- `frontend/src/app/features/dashboard/summary-chips.component.ts`

**Referencias:** `docs/layout.md` §Header, §Tab: Hoy, §Estado Angular

**Criterios de aceptación:**
- El header muestra: nombre "Daily Portal", fecha de hoy en español, botón "+ Recordatorio", botón Refrescar, toggle de tema
- El tab "Hoy" tiene un badge con el número de ítems pendientes (no atendidos)
- Clic en "+ Recordatorio" → cambia a tab Fuentes y hace scroll a la sección Recordatorios
- Clic en "Refrescar" → llama `POST /api/dashboard/refresh` + feedback visual de loading
- `DashboardStore.digest` se carga al montar el componente; `loading` muestra un spinner

---

### T16 · TodoListComponent (tab Hoy)

**Objetivo:** Lista de tareas del día con checkboxes, movimiento a sección "atendidos" y persistencia.

**Archivos a crear:**
- `frontend/src/app/features/todo/todo-list.component.ts`
- `frontend/src/app/features/todo/todo-list.component.html`
- `frontend/src/app/features/todo/todo-item.component.ts`
- `frontend/src/app/features/todo/todo-item.component.html`

**Referencias:** `docs/layout.md` §Lista TODO, §Comportamiento al marcar

**Criterios de aceptación:**
- Ítems ordenados: high → medium → low; ítems low con `opacity: 0.6`
- Clic en checkbox de un reminder → `PATCH /api/reminders/:id/complete` + ítem a sección "atendidos"
- Clic en checkbox de jira/github/calendar/slack → solo visual; ID guardado en `localStorage` key `portal:acknowledged:{YYYY-MM-DD}`
- Al recargar la página, los ítems marcados el día de hoy siguen apareciendo como atendidos
- Al iniciar un día nuevo, el localStorage del día anterior no afecta
- Desde la sección "atendidos" se puede desmarcar (undo visual; para reminders → no hace PATCH)
- Badge de fuente con color correcto por integración (tokens `integration-*`)
- Ítems con `url` son clickeables (abren nueva pestaña)

---

### T17 · SourcesComponent (tab Fuentes — secciones sin Recordatorios)

**Objetivo:** Vista detallada de Jira, GitHub, Calendar y Slack.

**Archivos a crear:**
- `frontend/src/app/features/sources/sources.component.ts`
- `frontend/src/app/features/sources/jira-section.component.ts`
- `frontend/src/app/features/sources/github-section.component.ts`
- `frontend/src/app/features/sources/calendar-section.component.ts`
- `frontend/src/app/features/sources/slack-section.component.ts`

**Referencias:** `docs/layout.md` §Tab: Fuentes; `docs/design-tokens.md` §Colores de integración

**Criterios de aceptación:**
- Secciones colapsables con header que muestra el ícono de la integración y el conteo
- **Jira:** tarjeta por tarea con key (`TEMP-123`), summary, status badge, link
- **GitHub:** tarjeta por PR con título, repo, badges de estado (conflicto=error, checks failing=error, new comments=warning, ok=success), link
- **Calendar:** lista con timeline (barra izquierda coloreada), hora de inicio, título, badge de calendario, botón Meet si existe `meetUrl`
- **Slack:** mención con borde izquierdo `--color-slack`, canal, remitente, texto truncado, link al mensaje
- Si una sección está vacía, mostrar estado vacío amigable (no ocultar la sección)

---

### T18 · RemindersSectionComponent + ReminderFormComponent

**Objetivo:** Sección de recordatorios con escalación visual y formulario de creación inline.

**Archivos a crear:**
- `frontend/src/app/features/sources/reminders-section/reminders-section.component.ts`
- `frontend/src/app/features/sources/reminders-section/reminder-item.component.ts`
- `frontend/src/app/features/sources/reminders-section/reminder-form.component.ts`

**Referencias:** `docs/layout.md` §Sección Recordatorios, §Formulario de crear recordatorio, §Lógica de escalación de prioridad

**Criterios de aceptación:**
- Cada reminder muestra badge de prioridad **efectiva** (no la stored)
- Cuando `escalatedPriority !== priority`, el badge incluye ícono `ti-trending-up` y subtexto "hace N días · prioridad original: {original}"
- El formulario aparece al hacer clic en "+ Nuevo" o en el botón del header global
- El formulario tiene: texto (required), fecha (default mañana), prioridad (default media)
- Al guardar → `POST /api/reminders` → el nuevo ítem aparece en la lista sin recargar
- Al cancelar → el formulario se colapsa sin enviar nada
- Input de texto inválido (vacío) → error de validación inline, no se envía

---

## Fase 6 — Docker y despliegue

### T19 · Dockerfile multi-stage

**Objetivo:** Imagen única que construye Angular, construye NestJS y embebe el frontend como archivos estáticos.

**Archivos a crear/modificar:**
- `backend/Dockerfile`

**Build context:** raíz del repo (`.`), no `./backend`.

**Referencias:** `AGENTS.md` §Estructura del Dockerfile; `daily-portal-architecture.md` §Dockerfile

**Criterios de aceptación:**
- Stage `frontend-builder`: `npm ci` + `ng build` → output en `/frontend/dist/daily-portal/`
- Stage `backend-builder`: `npm ci` + `npm run build` → output en `/app/dist/`
- Stage `final`: imagen Node 24 slim; copia `dist/` del backend y el build de Angular a `/app/public/`
- `docker build -t daily-portal .` termina sin errores (build context en raíz)
- `docker run -e SERVE_STATIC=true daily-portal` sirve el frontend en `http://localhost:3000`
- `docker run -e SERVE_STATIC=false daily-portal` expone solo `/api/*`

---

### T20 · Docker Compose + nginx + .env.example

**Objetivo:** Configuración completa de despliegue para RPi con soporte de perfil nginx.

**Archivos a crear/modificar:**
- `docker-compose.yml` — servicio `backend` + servicio `redis`. Puerto host `HOST_PORT` (default 8090).
- `docker-compose.nginx-override.yml` — perfil `nginx`, agrega contenedor nginx + mapeo de puertos
- `nginx/nginx.conf` — sirve Angular en `/` y hace proxy de `/api/` a backend
- `.env.example` — todas las variables con comentarios explicativos

**Referencias:** `AGENTS.md` §Modos de despliegue; `daily-portal-architecture.md` §Docker Compose

**Criterios de aceptación:**
- `docker compose up -d` levanta backend + redis; Angular servido por NestJS (SERVE_STATIC=true)
- `docker compose --profile nginx up -d` levanta backend + redis + nginx; Angular servido por nginx (SERVE_STATIC=false)
- El volumen `./data:/app/data` persiste la base de datos SQLite entre reinicios
- El volumen `redis-data` persiste el cache de Redis
- El puerto expuesto es `${HOST_PORT:-8090}:3000`
- `docker compose down && docker compose up -d` recupera todos los datos (SQLite persiste)

---

## Notas generales para Codex

- **Orden obligatorio:** las fases deben implementarse en orden. No saltar a Fase 5 sin tener Fase 4 funcionando.
- **ClickUp:** el módulo `backend/src/integrations/clickup/` puede crearse como stub vacío, pero **NO** se importa en `AppModule`.
- **Tests:** cada Service necesita un archivo `.spec.ts`. Mockear todas las dependencias externas (Redis, SQLite, APIs).
- **Logs:** usar siempre `new Logger(NombreClase.name)`. Nunca `console.log`.
- **Colores:** nunca hardcodear colores en templates Angular. Siempre `var(--color-*)` o clases `aurora-*`.
- **Prioridad efectiva:** en todo lugar donde se muestre o se ordene por prioridad de un reminder, usar `getEffectivePriority()` de `src/common/utils/reminder-priority.util.ts`.
