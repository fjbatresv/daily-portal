# Módulo: TelegramModule

## Responsabilidad

Formatear el `DailyDigest` como mensaje Markdown y enviarlo al chat personal del usuario vía Telegram Bot API. También registra cada envío en SQLite.

## Archivos a crear

```
backend/src/telegram/
├── telegram.module.ts
├── telegram.service.ts
└── telegram.formatter.ts   ← lógica de formateo separada del envío
```

## Configuración requerida

```typescript
telegram.botToken   // Token del bot (de @BotFather)
telegram.chatId     // Chat ID del usuario (de @userinfobot)
```

## Cómo crear el bot (una sola vez)

1. Abrir Telegram → buscar `@BotFather`
2. `/newbot` → seguir instrucciones → copiar el token
3. Iniciar conversación con el bot (enviarle cualquier mensaje)
4. Buscar `@userinfobot` → te dice tu chat ID → copiar a `.env`

## API externa

**Base URL:** `https://api.telegram.org/bot${botToken}`

### Enviar mensaje

```
POST /sendMessage
Content-Type: application/json

{
  "chat_id": "${chatId}",
  "text": "...",
  "parse_mode": "MarkdownV2",
  "disable_web_page_preview": true
}
```

**Importante:** Telegram MarkdownV2 requiere escapar los caracteres especiales:
`. ! - ( ) [ ] { } # + = | ~ >`

Escapar con backslash en el texto antes de enviar:
```typescript
private escape(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
```

## Interfaz del servicio

```typescript
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly formatter: TelegramFormatter,
    private readonly db: DatabaseService,   // para logs
  ) {}

  async sendMorningDigest(digest: DailyDigest): Promise<void>
  // 1. Llamar formatter.format(digest)
  // 2. POST a /sendMessage
  // 3. INSERT en notification_logs (status: 'success' o 'error')
  // 4. Si falla el envío: log error + INSERT con status 'error'
  // 5. NO relanzar la excepción (el scheduler no debe fallar)

  async sendTestMessage(text: string): Promise<void>
  // Útil para verificar que el bot funciona en el primer boot
}
```

## TelegramFormatter

```typescript
@Injectable()
export class TelegramFormatter {
  format(digest: DailyDigest): string
  // Retorna el mensaje completo en MarkdownV2 escapado

  private formatTasks(tasks: JiraTask[]): string
  private formatPRs(prs: GitHubPR[]): string
  private formatEvents(events: CalendarEvent[]): string
  private formatMentions(mentions: SlackMention[]): string
  private formatReminders(reminders: Reminder[]): string
  private formatTodoList(items: TodoItem[]): string
  private escape(text: string): string
}
```

## Formato del mensaje

```
📋 *Daily Digest — Lunes 29 Jun 2026*

📅 *Calendario* \(3 eventos\)
• 09:00 Stand\-up Tempus
• 11:00 Design Review
• 15:00 1:1 con manager

🎯 *Tareas Jira* \(2 activas\)
• \[TEMP\-123\] Implementar autenticación OAuth
• \[TEMP\-456\] Fix bug módulo de pagos

🔀 *PRs que requieren atención* \(2\)
• ⚠️ \[api\-gateway\] Comentarios nuevos
• 🔴 \[frontend\-app\] Checks fallando

💬 *Slack Tempus* \(3 menciones\)
• \#backend: "¿cuándo estará el endpoint?"

📌 *Recordatorios de hoy* \(1\)
• Enviar propuesta técnica

✅ *TODO del día*
1\. Responder comentarios en PR api\-gateway
2\. Atender mención en \#backend
3\. Continuar TEMP\-123
4\. Preparar material Design Review 11:00

_Generado a las 08:00_
```

### Reglas de formato

- Si una sección está vacía, mostrar la sección pero con `_Sin elementos_`
- PRs con `hasConflicts: true` → emoji 🔴 + texto "Conflictos de merge"
- PRs con `hasNewComments: true` → emoji ⚠️ + texto "Comentarios nuevos"
- PRs con `checkStatus: 'failure'` → emoji 🔴
- PRs con `checkStatus: 'success'` y sin comentarios → emoji ✅ (no listar, son buenos)
- Eventos con `meetUrl` → incluir el link como `[Meet](url)`
- Máximo 5 items por sección para no saturar el mensaje

## TelegramModule

```typescript
@Module({
  providers: [TelegramService, TelegramFormatter],
  exports: [TelegramService],
})
export class TelegramModule {}
```

## Registro en SQLite

```sql
-- Cada llamada a sendMorningDigest inserta un registro
INSERT INTO notification_logs (status, error_msg)
VALUES ('success', NULL);
-- o en caso de error:
INSERT INTO notification_logs (status, error_msg)
VALUES ('error', 'mensaje del error');
```

## Manejo de errores

- Si la API de Telegram devuelve error (ej. chat_id incorrecto): log descriptivo + insert en logs con status 'error'
- Si el mensaje es muy largo (Telegram tiene límite de 4096 caracteres): truncar el TODO list y agregar `... y N más`
- **Nunca lanzar excepción.** El scheduler no debe fallar si Telegram falla.

## Test unitario

Casos a cubrir:
- `TelegramFormatter.format()` con digest completo → string no vacío con todas las secciones
- Sección vacía → aparece con `_Sin elementos_`
- Texto con caracteres especiales → correctamente escapados
- `sendMorningDigest` con API OK → insert en logs con 'success'
- `sendMorningDigest` con API falla → insert en logs con 'error', no lanza excepción
