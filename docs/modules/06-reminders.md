# Módulo: RemindersModule

## Responsabilidad

CRUD de recordatorios del usuario, persistidos en SQLite. Es el único módulo que escribe en la base de datos de forma directa (sin integraciones externas).

## Archivos a crear

```
backend/src/reminders/
├── reminders.module.ts
├── reminders.controller.ts
├── reminders.service.ts
├── reminders.repository.ts   ← queries SQL con better-sqlite3
├── create-reminder.dto.ts
└── update-reminder.dto.ts
```

## Schema SQLite (ya en db/schema.sql)

```sql
CREATE TABLE IF NOT EXISTS reminders (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  text        TEXT NOT NULL,
  date        TEXT NOT NULL,
  priority    TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  completed   INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
```

## DatabaseModule / DatabaseService

Crear en `src/common/database/`:
```typescript
// database.service.ts
import Database from 'better-sqlite3';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db: Database.Database;

  onModuleInit(): void {
    this.db = new Database(this.config.get('sqlite.path'));
    this.db.pragma('journal_mode = WAL');   // mejor performance en lecturas concurrentes
    this.runMigrations();
  }

  onModuleDestroy(): void {
    this.db.close();
  }

  get instance(): Database.Database {
    return this.db;
  }

  private runMigrations(): void {
    // Leer y ejecutar db/schema.sql
    const schema = readFileSync(join(__dirname, '../../../db/schema.sql'), 'utf-8');
    this.db.exec(schema);
  }
}
```

Instalar: `npm install better-sqlite3 && npm install -D @types/better-sqlite3`

## RemindersRepository

```typescript
@Injectable()
export class RemindersRepository {
  constructor(private readonly db: DatabaseService) {}

  findByDate(date: string): ReminderRow[]
  findAll(): ReminderRow[]
  findById(id: string): ReminderRow | undefined
  create(dto: CreateReminderDto): ReminderRow
  update(id: string, dto: Partial<UpdateReminderDto>): ReminderRow | undefined
  complete(id: string): ReminderRow | undefined
  delete(id: string): boolean    // retorna true si existía
}
```

### Queries SQL

```typescript
// findByDate
const stmt = this.db.instance.prepare(
  `SELECT * FROM reminders WHERE date = ? AND completed = 0 ORDER BY priority DESC, created_at ASC`
);
return stmt.all(date) as ReminderRow[];

// create
const stmt = this.db.instance.prepare(
  `INSERT INTO reminders (text, date, priority) VALUES (?, ?, ?) RETURNING *`
);
return stmt.get(dto.text, dto.date, dto.priority ?? 'medium') as ReminderRow;

// complete
const stmt = this.db.instance.prepare(
  `UPDATE reminders SET completed = 1, updated_at = datetime('now') WHERE id = ? RETURNING *`
);

// delete
const stmt = this.db.instance.prepare(`DELETE FROM reminders WHERE id = ?`);
const result = stmt.run(id);
return result.changes > 0;
```

## DTOs

```typescript
// create-reminder.dto.ts
export class CreateReminderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text: string;

  @IsDateString()
  date: string;   // YYYY-MM-DD

  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: Priority = 'medium';
}

// update-reminder.dto.ts
export class UpdateReminderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: Priority;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
```

Instalar: `npm install class-validator class-transformer`
Habilitar en `main.ts`: `app.useGlobalPipes(new ValidationPipe({ whitelist: true }))`

## RemindersService

```typescript
@Injectable()
export class RemindersService {
  constructor(private readonly repo: RemindersRepository) {}

  getTodayReminders(): Reminder[]
  // repo.findByDate(today)  → mapear ReminderRow → Reminder

  listReminders(date?: string, all?: boolean): Reminder[]
  // all=true → repo.findAll()
  // date → repo.findByDate(date)
  // sin params → repo.findByDate(today)

  getById(id: string): Reminder
  // repo.findById(id) ?? throw NotFoundException

  create(dto: CreateReminderDto): Reminder

  update(id: string, dto: UpdateReminderDto): Reminder
  // verificar que existe antes de actualizar

  complete(id: string): Reminder

  delete(id: string): void
  // repo.delete(id) === false → throw NotFoundException
}
```

## RemindersController

```typescript
@Controller('api/reminders')
export class RemindersController {
  @Get()      listReminders(@Query('date') date?, @Query('all') all?)
  @Post()     create(@Body() dto: CreateReminderDto)
  @Get(':id') getById(@Param('id') id: string)
  @Patch(':id')         update(@Param('id') id, @Body() dto: UpdateReminderDto)
  @Patch(':id/complete') complete(@Param('id') id)
  @Delete(':id')        delete(@Param('id') id)
}
```

Respuestas HTTP según openapi.yaml:
- GET list → 200
- POST → 201
- GET by id → 200 / 404
- PATCH → 200 / 404
- DELETE → 204 / 404

## Mapeo ReminderRow → Reminder

```typescript
private mapRow(row: ReminderRow): Reminder {
  return {
    id: row.id,
    text: row.text,
    date: row.date,
    priority: row.priority as Priority,
    completed: row.completed === 1,   // SQLite guarda boolean como 0/1
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

## RemindersModule

```typescript
@Module({
  imports: [DatabaseModule],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersRepository],
  exports: [RemindersService],   // exportado para DailyAggregatorService
})
export class RemindersModule {}
```

---

## Escalación de prioridad dinámica

La prioridad almacenada en SQLite **nunca se modifica** por el paso del tiempo.
La prioridad efectiva se calcula al vuelo en base a cuántos días lleva pendiente el recordatorio.

### Utility function

Crear en `src/common/utils/reminder-priority.util.ts`:

```typescript
import { Priority, Reminder } from '../types/daily-digest.types';

/**
 * Calcula la prioridad efectiva de un recordatorio según los días transcurridos desde su fecha.
 * La prioridad almacenada en DB no se modifica — este cálculo es solo para display y ordenamiento.
 */
export function getEffectivePriority(reminder: Reminder): Priority {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reminderDate = new Date(reminder.date + 'T00:00:00');
  const daysPending = Math.floor((today.getTime() - reminderDate.getTime()) / 86_400_000);

  if (daysPending <= 0) return reminder.priority;  // mismo día o futuro → sin cambio

  if (reminder.priority === 'low') {
    if (daysPending >= 5) return 'high';
    if (daysPending >= 2) return 'medium';
    return 'low';
  }

  if (reminder.priority === 'medium') {
    if (daysPending >= 3) return 'high';
    return 'medium';
  }

  return 'high';  // alta nunca baja
}

/** Número de días que lleva pendiente (negativo = todavía futuro) */
export function getDaysPending(reminder: Reminder): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reminderDate = new Date(reminder.date + 'T00:00:00');
  return Math.floor((today.getTime() - reminderDate.getTime()) / 86_400_000);
}
```

### Tabla de escalación

| Prioridad original | Días pendiente | Prioridad efectiva |
|---|---|---|
| baja | 0–1 | baja |
| baja | 2–4 | media ↑ |
| baja | 5+ | alta ↑↑ |
| media | 0–2 | media |
| media | 3+ | alta ↑ |
| alta | cualquiera | alta |

### Dónde se usa

| Punto de uso | Propósito |
|---|---|
| `DailyAggregatorService.buildTodoList()` | Ordenar ítems de reminders por prioridad efectiva |
| `TelegramFormatter` | Ordenar y mostrar prioridad en el mensaje matutino |
| Frontend `reminder-item.component.ts` | Mostrar badge con prioridad efectiva + indicador de escalación |

`RemindersService.getTodayReminders()` retorna la prioridad **original** del campo `priority`.
Los consumidores llaman `getEffectivePriority(reminder)` cuando necesitan la prioridad real.

### Campo `daysOverdue` en la respuesta del API

El endpoint `GET /api/reminders` incluye `daysOverdue` y `escalatedPriority` como campos **calculados** (no almacenados):

```typescript
// En RemindersService — enriquecer la respuesta con campos computados
private mapRow(row: ReminderRow): Reminder & { daysOverdue: number; escalatedPriority: Priority } {
  const reminder = { /* ... mapeo base ... */ };
  return {
    ...reminder,
    daysOverdue: getDaysPending(reminder),
    escalatedPriority: getEffectivePriority(reminder),
  };
}
```

El frontend usa `escalatedPriority` para el badge y `daysOverdue` para el subtexto "hace N días".

---

## Test unitario

Casos a cubrir:
- `getTodayReminders` → solo los de hoy, no completados
- `create` con datos válidos → Reminder con id generado
- `update` de reminder inexistente → NotFoundException
- `delete` de reminder inexistente → NotFoundException
- `complete` → `completed: true`
- DTO inválido (text vacío, date mal formateada) → 400 con errores de validación
- `getEffectivePriority` — low + 1 día → low; low + 2 días → medium; low + 5 días → high
- `getEffectivePriority` — medium + 2 días → medium; medium + 3 días → high
- `getEffectivePriority` — high + 10 días → high (no baja)
- `getEffectivePriority` — fecha futura → prioridad original sin cambio
