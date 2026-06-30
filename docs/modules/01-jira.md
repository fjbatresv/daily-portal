# Módulo: JiraModule

## Responsabilidad

Obtener las tareas de Jira (proyecto Tempus) asignadas al usuario autenticado con estado `In Progress` o `To Do`.

## Archivos a crear

```
backend/src/integrations/jira/
├── jira.module.ts
├── jira.service.ts
└── jira.types.ts        ← tipos internos, no duplicar los de daily-digest.types.ts
```

## Configuración requerida (via ConfigService)

```typescript
jira.baseUrl      // https://tu-org.atlassian.net
jira.email        // fjbatresv@gmail.com
jira.apiToken     // token de API de Atlassian
jira.projectKey   // ej: TEMP
```

## Autenticación

HTTP Basic Auth con `email:apiToken` en Base64.

```
Authorization: Basic base64(email:apiToken)
Content-Type: application/json
```

## API externa

**Base URL:** `${jira.baseUrl}/rest/api/3`

### Endpoint principal

```
GET /rest/api/3/search
```

**Query params:**
```
jql=project={projectKey} AND assignee=currentUser() AND statusCategory in ("In Progress","To Do") ORDER BY updated DESC
fields=summary,status,priority,assignee
maxResults=20
```

**Respuesta esperada (simplificada):**
```json
{
  "issues": [
    {
      "id": "10001",
      "key": "TEMP-123",
      "fields": {
        "summary": "Implementar autenticación OAuth",
        "status": { "name": "In Progress" },
        "priority": { "name": "High" }
      }
    }
  ]
}
```

## Interfaz del servicio

```typescript
// jira.service.ts
@Injectable()
export class JiraService {
  private readonly logger = new Logger(JiraService.name);
  private readonly CACHE_KEY = 'jira:tasks';
  private readonly CACHE_TTL = 15 * 60; // 15 minutos

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  async getTasks(): Promise<JiraTask[]>
  // 1. cache.get(CACHE_KEY) → si hit, retornar
  // 2. Llamar GET /rest/api/3/search con JQL
  // 3. Mapear issues a JiraTask[]
  // 4. cache.set(CACHE_KEY, tasks, CACHE_TTL)
  // 5. Si falla la API: log error, retornar []

  private mapIssue(issue: JiraApiIssue): JiraTask
  // Mapea el objeto crudo de Jira al tipo JiraTask
  // URL construida como: `${baseUrl}/browse/${issue.key}`
}
```

## Tipo de retorno (mapeo desde Jira API)

```typescript
// Desde daily-digest.types.ts (NO redefinir aquí)
interface JiraTask {
  id: string;       // issue.id
  key: string;      // issue.key  →  "TEMP-123"
  summary: string;  // issue.fields.summary
  status: string;   // issue.fields.status.name
  priority: string; // issue.fields.priority.name
  url: string;      // `${baseUrl}/browse/${issue.key}`
}
```

## JiraModule

```typescript
@Module({
  imports: [CacheModule],
  providers: [JiraService],
  exports: [JiraService],
})
export class JiraModule {}
```

## Manejo de errores

- Si la API retorna 401: log `"Jira: credenciales inválidas"`, retornar `[]`
- Si la API retorna 429: log `"Jira: rate limit"`, retornar datos de cache si existen
- Si cualquier otro error HTTP: log error completo, retornar `[]`
- **Nunca lanzar excepción hacia el aggregator.** Siempre retornar array vacío.

## Test unitario (jira.service.spec.ts)

Casos a cubrir:
- Cache hit → retorna datos sin llamar HTTP
- Cache miss + API OK → retorna tareas mapeadas y cachea
- Cache miss + API falla → retorna `[]` y loguea el error
- Mapeo correcto de campos de Jira a `JiraTask`
