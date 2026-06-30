# Layout del Portal

## Estructura general

```
┌─────────────────────────────────────────────┐
│ Header: logo · fecha · + Recordatorio · ↺ ☾ │
├─────────────────────────────────────────────┤
│ Tabs:  [ Hoy (N) ]  [ Fuentes ]             │
├─────────────────────────────────────────────┤
│                                             │
│  Contenido del tab activo                  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Header (siempre visible)

| Elemento | Posición | Comportamiento |
|---|---|---|
| Logo + nombre "Daily Portal" | Izquierda | Estático |
| Fecha actual | Bajo el nombre | Formato: "Lunes 29 de junio, 2026" |
| Botón "+ Recordatorio" | Derecha | Abre el formulario de crear recordatorio en tab Fuentes |
| Botón Refrescar | Derecha | Llama `POST /api/dashboard/refresh` → invalida cache |
| Botón Tema | Derecha | Toggle dark/light via `ThemeService` |

---

## Tab: Hoy

Vista principal. Lista de tareas del día, ordenada por prioridad. **Cada ítem es accionable.**

### Summary chips

Fila de contadores al tope. Solo muestra categorías con al menos 1 ítem:
- 🔴 N urgentes (PRs con conflictos o checks fallando)
- Tareas (Jira activas)
- Eventos (Calendar)
- Menciones (Slack)

### Lista TODO

Cada ítem tiene:
- **Checkbox** a la izquierda — marca el ítem como atendido
- **Badge de fuente** — color diferenciado por integración
- **Texto** de la tarea
- **Metadata** — hora, tiempo relativo o estado

**Comportamiento al marcar:**
1. El ítem recibe tachado + opacidad reducida
2. Se mueve al fondo de la lista en una sección "N atendidos"
3. El contador del tab se decrementa
4. Desde la sección de atendidos, se puede desmarcar (undo)

**Qué significa "marcar como atendido" por fuente:**

| Fuente | Efecto en backend |
|---|---|
| Reminder | `PATCH /api/reminders/:id/complete` → marca en SQLite |
| Jira | Solo visual (no modifica Jira). El ítem desaparece si el cache se refresca y el estado cambió. |
| GitHub | Solo visual. El PR seguirá apareciendo mientras esté abierto. |
| Calendar | Solo visual. El evento es pasado, no hay acción. |
| Slack | Solo visual. Marca como "leído localmente". |

El frontend guarda el estado "atendido" de ítems no-reminder en `localStorage` con key `portal:acknowledged:{date}`. Se limpia automáticamente al día siguiente.

### Ordenamiento de ítems

```
1. Alta prioridad:
   - PR con conflictos de merge
   - PR con checks fallando
   - PR con comentarios nuevos
   - Reminders con priority=high (incluyendo escalados)

2. Media prioridad:
   - Reminders con priority=medium (incluyendo escalados)
   - Menciones Slack
   - Tareas Jira In Progress
   - Eventos del día

3. Baja prioridad (atenuados, opacity: 0.6):
   - Reminders con priority=low (sin escalar)
   - Tareas Jira To Do
   - PRs sin problemas (solo visibilidad)
```

---

## Tab: Fuentes

Vista detallada organizada por integración. Orden de secciones:

1. **Jira** — tarjetas de tickets con estado y prioridad
2. **GitHub PRs** — tarjetas con badges de estado (conflictos, checks, comentarios)
3. **Calendario** — lista de eventos con timeline visual (barra izquierda + dot)
4. **Slack** — menciones con borde izquierdo violeta y canal/remitente
5. **Recordatorios** — lista con escalación visible + formulario de crear

### Sección Recordatorios

Es la única sección con acción de escritura. Tiene:
- Botón "+ Nuevo" en el header de la sección (igual que el del header global)
- Lista de recordatorios pendientes con badge de prioridad actual
- Indicador de escalación cuando la prioridad fue subida automáticamente
- Formulario de crear (colapsable, se abre debajo del header de sección)

---

## Formulario de crear recordatorio

Se abre desde dos puntos:
- Botón "+ Recordatorio" en el header global
- Botón "+ Nuevo" en el header de la sección Recordatorios en tab Fuentes

Ambos abren el mismo formulario en tab Fuentes (si el usuario está en Hoy, cambia el tab).

**Campos:**
- Texto (input libre, required, maxLength 500)
- Fecha (date picker, default: mañana)
- Prioridad inicial (select: baja / media / alta, default: media)

**Al guardar:** `POST /api/reminders` → el ítem aparece en la lista sin recargar la página.

---

## Lógica de escalación de prioridad (Reminders)

La prioridad de un recordatorio sube automáticamente según los días que lleva sin completarse. La prioridad guardada en SQLite **no se modifica** — la escalación es solo para display y para el ordenamiento en el TODO list.

### Regla de escalación

```typescript
function getEffectivePriority(reminder: Reminder): Priority {
  const daysPending = differenceInDays(new Date(), parseISO(reminder.date));

  if (daysPending <= 0) return reminder.priority;      // mismo día o futuro → sin cambio

  if (reminder.priority === 'low') {
    if (daysPending >= 5) return 'high';
    if (daysPending >= 2) return 'medium';
    return 'low';
  }

  if (reminder.priority === 'medium') {
    if (daysPending >= 3) return 'high';
    return 'medium';
  }

  return 'high';    // alta nunca baja
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

### Display en UI

Cuando la prioridad escaló (efectiva > original), mostrar el badge con:
- Ícono `ti-trending-up`
- Color de la prioridad **efectiva** (no la original)
- Tooltip o subtexto: "hace N días · prioridad original: baja"

Cuando no escaló, mostrar badge simple sin ícono.

### Dónde se aplica la escalación

- `DailyAggregatorService.buildTodoList()` — usa `getEffectivePriority()` para ordenar
- `TelegramFormatter` — usa `getEffectivePriority()` para el mensaje matutino
- `RemindersService.getTodayReminders()` — retorna la prioridad original; el frontend/aggregator calcula la efectiva
- La función `getEffectivePriority` vive en `src/common/utils/reminder-priority.util.ts` y es importada por el aggregator y el formatter

---

## Componentes Angular a crear

```
features/
├── dashboard/
│   ├── dashboard.component.ts          ← shell con header + tabs
│   ├── dashboard.component.html
│   └── summary-chips.component.ts      ← fila de chips
│
├── todo/
│   ├── todo-list.component.ts          ← lista con checkboxes
│   ├── todo-item.component.ts          ← ítem individual
│   └── todo-item.component.html
│
└── sources/
    ├── sources.component.ts            ← contenedor de secciones
    ├── jira-section.component.ts
    ├── github-section.component.ts
    ├── calendar-section.component.ts
    ├── slack-section.component.ts
    └── reminders-section/
        ├── reminders-section.component.ts
        ├── reminder-item.component.ts
        └── reminder-form.component.ts  ← formulario crear/editar
```

### Estado del dashboard (Angular signals)

```typescript
// dashboard.store.ts  (signal-based, sin NgRx)
export class DashboardStore {
  digest    = signal<DailyDigest | null>(null);
  loading   = signal(false);
  activeTab = signal<'hoy' | 'fuentes'>('hoy');

  // IDs de ítems marcados como atendidos en esta sesión
  // Persistido en localStorage key: portal:acknowledged:{YYYY-MM-DD}
  acknowledged = signal<Set<string>>(new Set());
}
```
