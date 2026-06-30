# Módulo: SlackModule

## Responsabilidad

Obtener menciones al usuario en el workspace de Tempus usando un **User OAuth Token** (`xoxp-`). No se crea ningún bot en Slack ni se necesita invitar la app a ningún canal.

## Archivos a crear

```
backend/src/integrations/slack/
├── slack.module.ts
├── slack.service.ts
└── slack.types.ts
```

## Configuración requerida

```typescript
slack.userToken  // xoxp-... (User OAuth Token)
slack.userId     // ID del usuario (Uxxxxxxxxxxx)
```

## Cómo obtener las credenciales

1. Ir a [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Nombre: `Daily Portal` / Workspace: Tempus
3. Ir a **OAuth & Permissions** → **User Token Scopes** → agregar:
   - `search:read` — buscar mensajes con menciones
   - `channels:history` — leer historial (para contexto futuro)
   - `im:history` — leer DMs
   - `users:read` — resolver IDs a nombres
4. **Install to Workspace** → copiar **User OAuth Token** (`xoxp-...`)
5. Para el `userId`: Settings del perfil en Slack → tres puntos → **Copy member ID**

## Autenticación

```
Authorization: Bearer ${slack.userToken}
Content-Type: application/json
```

## API externa

**Base URL:** `https://slack.com/api`

### Endpoint: search.messages

```
GET /search.messages
```

**Parámetros:**
```
query=<@${userId}>    ← menciones directas al usuario
count=20
sort=timestamp
sort_dir=desc
```

**Respuesta esperada:**
```json
{
  "ok": true,
  "messages": {
    "matches": [
      {
        "ts": "1234567890.123456",
        "channel": {
          "id": "C123",
          "name": "backend"
        },
        "username": "ana.garcia",
        "text": "<@U123456> ¿cuándo estará listo el endpoint?",
        "permalink": "https://tempus.slack.com/archives/C123/p1234567890123456"
      }
    ]
  }
}
```

### Filtrado por tiempo

Filtrar solo mensajes de las **últimas 24 horas**:
```typescript
const cutoff = Date.now() / 1000 - 24 * 60 * 60; // Unix timestamp
const recentMentions = matches.filter(m => parseFloat(m.ts) > cutoff);
```

## Interfaz del servicio

```typescript
@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly CACHE_KEY = 'slack:mentions';
  private readonly CACHE_TTL = 5 * 60; // 5 minutos

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  async getMentions(): Promise<SlackMention[]>
  // 1. cache.get(CACHE_KEY)
  // 2. GET /search.messages con query <@userId>
  // 3. Filtrar últimas 24h
  // 4. Mapear a SlackMention[]
  // 5. cache.set(CACHE_KEY, mentions, CACHE_TTL)
  // 6. Si falla o ok=false: log + retornar []

  private mapMatch(match: SlackApiMatch): SlackMention
}
```

## Tipo de retorno (mapeo)

```typescript
// Desde daily-digest.types.ts
interface SlackMention {
  ts: string;           // match.ts
  channelName: string;  // match.channel.name
  senderName: string;   // match.username
  text: string;         // match.text (puede contener <@Uxxxx>, limpiar si se desea)
  permalink: string;    // match.permalink
}
```

### Limpiar texto de menciones (opcional pero recomendado)

```typescript
// Reemplazar <@Uxxxxxxx> con @username usando users.info
// Solo si la performance lo permite; sino, dejar el texto raw
private cleanSlackText(text: string): string {
  return text.replace(/<@U[A-Z0-9]+>/g, '@user');
}
```

## SlackModule

```typescript
@Module({
  imports: [CacheModule],
  providers: [SlackService],
  exports: [SlackService],
})
export class SlackModule {}
```

## Manejo de errores

La API de Slack retorna siempre HTTP 200, pero con `ok: false` en error:

```typescript
const res = await fetch(url, { headers });
const data = await res.json();

if (!data.ok) {
  this.logger.error(`Slack API error: ${data.error}`);
  return [];
}
```

Errores comunes:
- `missing_scope`: el token no tiene el scope necesario
- `invalid_auth`: token inválido o revocado
- `ratelimited`: esperar, usar cache

## Test unitario (slack.service.spec.ts)

Casos a cubrir:
- Cache hit → sin llamada HTTP
- Cache miss + respuesta OK → menciones de últimas 24h
- Mensajes más antiguos de 24h → filtrados
- `ok: false` en respuesta → retornar `[]` + log
- Error de red → retornar `[]`
