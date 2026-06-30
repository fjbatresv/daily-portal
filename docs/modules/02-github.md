# Módulo: GitHubModule

## Responsabilidad

Obtener los Pull Requests de GitHub donde el usuario es el autor o reviewer asignado, incluyendo estado de comentarios, checks de CI y conflictos de merge.

## Archivos a crear

```
backend/src/integrations/github/
├── github.module.ts
├── github.service.ts
├── github.queries.ts    ← queries GraphQL como constantes
└── github.types.ts      ← tipos internos del mapping
```

## Configuración requerida

```typescript
github.token     // Personal Access Token
github.username  // username de GitHub
```

## Autenticación

```
Authorization: Bearer ${github.token}
Content-Type: application/json
```

## API externa

**Endpoint:** `https://api.github.com/graphql`  
**Método:** `POST`

### Query GraphQL principal

```graphql
# Guardar en github.queries.ts como constante SEARCH_PRS_QUERY
query SearchAssignedPRs($username: String!) {
  search(
    query: "is:pr is:open author:$username"
    type: ISSUE
    first: 20
  ) {
    nodes {
      ... on PullRequest {
        id
        number
        title
        url
        isDraft
        updatedAt
        mergeable        # CONFLICTING | MERGEABLE | UNKNOWN
        repository {
          nameWithOwner  # "org/repo"
        }
        state            # OPEN | MERGED | CLOSED
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state    # SUCCESS | FAILURE | PENDING | ERROR
              }
            }
          }
        }
        comments(last: 5) {
          totalCount
          nodes {
            createdAt
            author { login }
          }
        }
        reviews(last: 5, states: [COMMENTED, CHANGES_REQUESTED]) {
          totalCount
          nodes {
            createdAt
            author { login }
          }
        }
      }
    }
  }
}
```

### Lógica de `hasNewComments`

Un PR tiene comentarios nuevos si existe algún comentario o review con `createdAt` dentro de las últimas 24 horas y el autor no es el propio usuario.

```typescript
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
const hasNewComments = [
  ...pr.comments.nodes,
  ...pr.reviews.nodes,
].some(
  (c) => new Date(c.createdAt) > cutoff && c.author.login !== username
);
```

## Interfaz del servicio

```typescript
@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private readonly CACHE_KEY = 'github:prs';
  private readonly CACHE_TTL = 5 * 60; // 5 minutos

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  async getPRs(): Promise<GitHubPR[]>
  // 1. cache.get(CACHE_KEY)
  // 2. POST a GraphQL con SEARCH_PRS_QUERY
  // 3. Mapear nodos a GitHubPR[]
  // 4. cache.set(CACHE_KEY, prs, CACHE_TTL)
  // 5. Si falla: log + retornar []

  private mapPR(node: GitHubPRNode, username: string): GitHubPR
}
```

## Tipo de retorno (mapeo desde GraphQL)

```typescript
// Desde daily-digest.types.ts
interface GitHubPR {
  id: number;              // node.number
  title: string;
  url: string;
  repo: string;            // node.repository.nameWithOwner
  status: PRStatus;        // node.state.toLowerCase()
  isDraft: boolean;
  hasNewComments: boolean; // ver lógica arriba
  checkStatus: CheckStatus;// node.commits.nodes[0]?.commit.statusCheckRollup?.state → lowercase
  hasConflicts: boolean;   // node.mergeable === 'CONFLICTING'
  updatedAt: string;
}
```

## Mapeo de estados

| GitHub API | Tipo local |
|---|---|
| `state: OPEN` | `'open'` |
| `state: MERGED` | `'merged'` |
| `state: CLOSED` | `'closed'` |
| `isDraft: true` | `'draft'` (sobrescribe status) |
| `statusCheckRollup.state: SUCCESS` | `'success'` |
| `statusCheckRollup.state: null` | `'pending'` |
| `mergeable: CONFLICTING` | `hasConflicts: true` |

## GitHubModule

```typescript
@Module({
  imports: [CacheModule],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}
```

## HTTP client

Usar `axios` o `node-fetch` directamente (no el `HttpModule` de NestJS para mayor control sobre headers y retry).
Instalar: `npm install axios`

## Manejo de errores

- 401: log `"GitHub: token inválido o expirado"`, retornar `[]`
- 403: puede ser rate limit (GitHub GraphQL usa 5000 points/hora), log + retornar cache si existe
- Cualquier error de red: log + retornar `[]`

## Test unitario (github.service.spec.ts)

Casos a cubrir:
- Cache hit → sin llamada HTTP
- Cache miss + respuesta GraphQL OK → PRs mapeados correctamente
- PR con `mergeable: CONFLICTING` → `hasConflicts: true`
- PR con comentario de tercero en últimas 24h → `hasNewComments: true`
- PR draft → `status: 'draft'`
- Error de red → retorna `[]`
