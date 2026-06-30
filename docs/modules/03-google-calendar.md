# Módulo: GoogleCalendarModule

## Responsabilidad

Obtener los eventos del día actual de **2 calendarios configurados** usando la Google Calendar API v3 con autenticación OAuth2 via refresh token (sin flujo interactivo).

## Archivos a crear

```
backend/src/integrations/google-calendar/
├── gcal.module.ts
├── gcal.service.ts
└── gcal.types.ts
```

## Configuración requerida

```typescript
googleCalendar.clientId       // OAuth2 Client ID
googleCalendar.clientSecret   // OAuth2 Client Secret
googleCalendar.refreshToken   // Refresh token obtenido con OAuth2 Playground
googleCalendar.calendarIds    // string[] — exactamente 2 IDs
// Ejemplo: ['primary', 'xxx@group.calendar.google.com']
```

## Autenticación — OAuth2 con Refresh Token

No hay flujo interactivo. Al inicializar el servicio, usar el refresh token para obtener un access token. El access token expira cada ~1 hora, por lo que se debe refrescar automáticamente.

**Librería recomendada:** `googleapis` (oficial de Google)
```bash
npm install googleapis
```

```typescript
import { google } from 'googleapis';

// En el constructor del servicio:
const auth = new google.auth.OAuth2(
  config.get('googleCalendar.clientId'),
  config.get('googleCalendar.clientSecret'),
);
auth.setCredentials({
  refresh_token: config.get('googleCalendar.refreshToken'),
});
// La librería renueva el access token automáticamente
const calendar = google.calendar({ version: 'v3', auth });
```

## API externa

**Librería:** `googleapis` (no llamar HTTP directamente)

### Obtener eventos del día

```typescript
const now = new Date();
const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

const response = await calendar.events.list({
  calendarId: calendarId,          // iterar por cada uno de los 2 IDs
  timeMin: startOfDay.toISOString(),
  timeMax: endOfDay.toISOString(),
  singleEvents: true,              // expande eventos recurrentes
  orderBy: 'startTime',
  maxResults: 20,
});
```

## Interfaz del servicio

```typescript
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly CACHE_KEY = 'gcal:events';
  private readonly CACHE_TTL = 10 * 60; // 10 minutos
  private calendar: ReturnType<typeof google.calendar>;

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  onModuleInit(): void
  // Inicializar OAuth2 client y google.calendar aquí

  async getEvents(): Promise<CalendarEvent[]>
  // 1. cache.get(CACHE_KEY)
  // 2. Para cada calendarId: calendar.events.list(...)
  //    → Usar Promise.all para los 2 calendarios en paralelo
  // 3. Flatten y ordenar por startTime
  // 4. cache.set(CACHE_KEY, events, CACHE_TTL)
  // 5. Si falla: log + retornar []

  private mapEvent(event: calendar_v3.Schema$Event, calendarId: string, calendarName: string): CalendarEvent
}
```

## Obtener el nombre del calendario

Antes de listar eventos, obtener el metadata de cada calendario para tener su `summary` (nombre):

```typescript
const meta = await calendar.calendars.get({ calendarId });
const calendarName = meta.data.summary ?? calendarId;
```

Cachear este mapping `calendarId → name` en el constructor (no cambia).

## Tipo de retorno (mapeo)

```typescript
// Desde daily-digest.types.ts
interface CalendarEvent {
  id: string;           // event.id
  title: string;        // event.summary ?? '(sin título)'
  startTime: string;    // event.start.dateTime ?? event.start.date + 'T00:00:00'
  endTime: string;      // event.end.dateTime ?? event.end.date + 'T23:59:59'
  calendarId: string;
  calendarName: string;
  isAllDay: boolean;    // !!event.start.date && !event.start.dateTime
  meetUrl?: string;     // event.hangoutLink ?? extraer de event.description
}
```

## Extraer Google Meet URL

```typescript
// Primero buscar el campo nativo
const meetUrl = event.hangoutLink
  ?? event.conferenceData?.entryPoints
       ?.find(ep => ep.entryPointType === 'video')
       ?.uri;
```

## GoogleCalendarModule

```typescript
@Module({
  imports: [CacheModule],
  providers: [GoogleCalendarService],
  exports: [GoogleCalendarService],
})
export class GoogleCalendarModule {}
```

## Manejo de errores

- Error 401: el refresh token expiró o fue revocado. Log claro: `"Google Calendar: refresh token inválido. Re-generar en OAuth2 Playground."`. Retornar `[]`.
- Error de red: log + retornar `[]`
- Si un calendario falla pero el otro funciona: incluir los eventos del que funcionó, log del error del que falló.

## Test unitario (gcal.service.spec.ts)

Casos a cubrir:
- Cache hit → sin llamada a API
- 2 calendarios OK → eventos de ambos mezclados y ordenados por startTime
- Un calendario falla → eventos del otro + log del error
- Evento de día completo (`start.date`) → `isAllDay: true`
- Evento con `hangoutLink` → `meetUrl` populado
- Refresh token inválido → `[]` + log descriptivo
