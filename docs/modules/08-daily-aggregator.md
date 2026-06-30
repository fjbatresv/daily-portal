# Módulo: DailyAggregatorService

## Responsabilidad

Orquestar todas las integraciones en paralelo, construir la lista TODO priorizada y retornar el `DailyDigest` completo. Es el cerebro del sistema.

## Ubicación

```
backend/src/dashboard/
├── dashboard.module.ts
├── dashboard.controller.ts     ← expone GET /api/dashboard y POST /api/dashboard/refresh
└── daily-aggregator.service.ts ← este módulo
```

## Interfaz del servicio

```typescript
@Injectable()
export class DailyAggregatorService {
  private readonly logger = new Logger(DailyAggregatorService.name);

  constructor(
    private readonly jira: JiraService,
    private readonly github: GitHubService,
    private readonly gcal: GoogleCalendarService,
    private readonly slack: SlackService,
    private readonly reminders: RemindersService,
    private readonly cache: CacheService,
  ) {}

  async buildDailyDigest(): Promise<DailyDigest>

  async invalidateCache(): Promise<void>
  // Borra todas las claves de cache de integraciones
  // Llamado por POST /api/dashboard/refresh

  private buildTodoList(
    tasks: JiraTask[],
    prs: GitHubPR[],
    events: CalendarEvent[],
    mentions: SlackMention[],
    reminders: Reminder[],
  ): TodoItem[]
}
```

## Implementación de buildDailyDigest

```typescript
async buildDailyDigest(): Promise<DailyDigest> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Todas las integraciones en paralelo
  // Promise.allSettled garantiza que el digest se genera aunque alguna falle
  const [tasksResult, prsResult, eventsResult, mentionsResult] = await Promise.allSettled([
    this.jira.getTasks(),
    this.github.getPRs(),
    this.gcal.getEvents(),
    this.slack.getMentions(),
  ]);

  // Reminders es SQLite local — no puede "fallar de red", pero igual proteger
  let reminders: Reminder[] = [];
  try {
    reminders = this.reminders.getTodayReminders();
  } catch (e) {
    this.logger.error('Failed to get reminders', e);
  }

  // Extraer data de los settled results, array vacío si falló
  const tasks    = tasksResult.status === 'fulfilled'    ? tasksResult.value    : [];
  const prs      = prsResult.status === 'fulfilled'      ? prsResult.value      : [];
  const events   = eventsResult.status === 'fulfilled'   ? eventsResult.value   : [];
  const mentions = mentionsResult.status === 'fulfilled' ? mentionsResult.value : [];

  // Loguear fallos parciales
  [tasksResult, prsResult, eventsResult, mentionsResult].forEach((r, i) => {
    if (r.status === 'rejected') {
      const names = ['jira', 'github', 'gcal', 'slack'];
      this.logger.warn(`Integration ${names[i]} failed: ${r.reason}`);
    }
  });

  const todoList = this.buildTodoList(tasks, prs, events, mentions, reminders);

  return {
    date: today,
    generatedAt: new Date().toISOString(),
    todoList,
    tasks,
    prs,
    events,
    slackMentions: mentions,
    reminders,
  };
}
```

## Algoritmo buildTodoList — Priorización

El objetivo es generar una lista ordenada de acciones concretas para el día.

### Reglas de prioridad

**ALTA (high):**
- PR con `hasConflicts: true` → "Resolver conflictos de merge en {repo}"
- PR con `checkStatus: 'failure'` → "Checks fallando en {repo}"
- PR con `hasNewComments: true` → "Revisar comentarios en PR: {title}"
- Recordatorio con `priority: 'high'`
- Evento en los próximos 30 minutos (si es horario de 8 AM)

**MEDIA (medium):**
- Tarea Jira con status `In Progress`
- Mención en Slack → "Responder mención en #{channel}: {texto truncado a 50 chars}"
- Recordatorio con `priority: 'medium'`
- Evento del día (todos los no-urgentes)

**BAJA (low):**
- Tarea Jira con status `To Do`
- PR abierto sin problemas (solo para visibilidad)
- Recordatorio con `priority: 'low'`

### Implementación

```typescript
private buildTodoList(
  tasks: JiraTask[],
  prs: GitHubPR[],
  events: CalendarEvent[],
  mentions: SlackMention[],
  reminders: Reminder[],
): TodoItem[] {
  const items: TodoItem[] = [];

  // PRs con problemas (alta prioridad)
  for (const pr of prs) {
    if (pr.hasConflicts) {
      items.push({ source: 'github', priority: 'high', text: `Resolver conflictos: ${pr.title}`, url: pr.url });
    }
    if (pr.checkStatus === 'failure') {
      items.push({ source: 'github', priority: 'high', text: `Checks fallando: ${pr.title}`, url: pr.url });
    }
    if (pr.hasNewComments && !pr.hasConflicts && pr.checkStatus !== 'failure') {
      items.push({ source: 'github', priority: 'high', text: `Revisar comentarios: ${pr.title}`, url: pr.url });
    }
  }

  // Recordatorios de hoy — usar prioridad EFECTIVA para ordenamiento
  for (const r of reminders.filter(r => !r.completed)) {
    const effectivePriority = getEffectivePriority(r);  // de reminder-priority.util.ts
    items.push({ source: 'reminder', priority: effectivePriority, text: r.text });
  }

  // Tareas Jira In Progress
  for (const t of tasks.filter(t => t.status.toLowerCase().includes('progress'))) {
    items.push({ source: 'jira', priority: 'medium', text: `Continuar: ${t.summary}`, url: t.url });
  }

  // Menciones Slack
  for (const m of mentions) {
    const shortText = m.text.length > 50 ? m.text.substring(0, 47) + '...' : m.text;
    items.push({ source: 'slack', priority: 'medium', text: `#${m.channelName}: ${shortText}`, url: m.permalink });
  }

  // Eventos del día
  for (const e of events) {
    const time = e.isAllDay ? '' : new Date(e.startTime).toTimeString().slice(0, 5);
    items.push({ source: 'calendar', priority: 'medium', text: e.title, dueTime: time || undefined, url: e.meetUrl });
  }

  // Tareas Jira To Do
  for (const t of tasks.filter(t => t.status.toLowerCase() === 'to do')) {
    items.push({ source: 'jira', priority: 'low', text: t.summary, url: t.url });
  }

  // Ordenar: high → medium → low, y dentro de cada grupo por source
  const order: Priority[] = ['high', 'medium', 'low'];
  return items.sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
}
```

## invalidateCache

```typescript
async invalidateCache(): Promise<void> {
  await Promise.all([
    this.cache.del('jira:tasks'),
    this.cache.del('github:prs'),
    this.cache.del('gcal:events'),
    this.cache.del('slack:mentions'),
  ]);
  this.logger.log('Cache invalidated — next digest will fetch fresh data');
}
```

## DashboardController

```typescript
@Controller()
export class DashboardController {
  constructor(private readonly aggregator: DailyAggregatorService) {}

  @Get('api/health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() };
  }

  @Get('api/dashboard')
  async getDailyDigest(): Promise<DailyDigest> {
    return this.aggregator.buildDailyDigest();
  }

  @Post('api/dashboard/refresh')
  async refreshDailyDigest(): Promise<DailyDigest> {
    await this.aggregator.invalidateCache();
    return this.aggregator.buildDailyDigest();
  }
}
```

## DashboardModule

```typescript
@Module({
  imports: [
    JiraModule,
    GitHubModule,
    GoogleCalendarModule,
    SlackModule,
    RemindersModule,
    CacheModule,
  ],
  controllers: [DashboardController],
  providers: [DailyAggregatorService],
  exports: [DailyAggregatorService],  // exportado para SchedulerModule
})
export class DashboardModule {}
```

## Test unitario (daily-aggregator.service.spec.ts)

Casos a cubrir:
- Todas las integraciones OK → DailyDigest con todos los datos
- Una integración falla → DailyDigest con esa sección vacía, el resto normal
- Todas las integraciones fallan → DailyDigest con todas las secciones vacías (no lanza error)
- `buildTodoList` con PR con conflictos → item de alta prioridad
- `buildTodoList` con recordatorio de alta prioridad → aparece antes que tareas Jira
- `invalidateCache` llama a `cache.del` para todas las claves
