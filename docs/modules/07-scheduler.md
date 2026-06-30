# Módulo: SchedulerModule

## Responsabilidad

Ejecutar el cron job diario a las 8:00 AM que genera el `DailyDigest` y lo envía por Telegram. Un módulo delgado: no tiene lógica propia, solo orquesta `DailyAggregatorService` y `TelegramService`.

## Archivos a crear

```
backend/src/scheduler/
├── scheduler.module.ts
└── scheduler.service.ts
```

## Dependencias npm

```bash
npm install @nestjs/schedule
npm install -D @types/cron
```

Registrar en `AppModule`:
```typescript
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // ...resto de módulos
  ],
})
export class AppModule {}
```

## Configuración

```typescript
scheduler.cron     // default: '0 8 * * *'  (8:00 AM todos los días)
scheduler.timezone // default: 'America/Guatemala'
```

## SchedulerService

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly aggregator: DailyAggregatorService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @Cron(
    process.env.MORNING_DIGEST_CRON ?? '0 8 * * *',
    { timeZone: process.env.TZ ?? 'America/Guatemala' }
  )
  async runMorningDigest(): Promise<void> {
    this.logger.log('Starting morning digest...');

    try {
      const digest = await this.aggregator.buildDailyDigest();
      await this.telegram.sendMorningDigest(digest);
      this.logger.log(`Morning digest sent. TODO items: ${digest.todoList.length}`);
    } catch (error) {
      // Solo loguear — nunca dejar caer el proceso
      this.logger.error('Morning digest failed', error);
    }
  }
}
```

**Nota importante:** el decorador `@Cron` acepta el cron string directamente (no via ConfigService en tiempo de definición del decorador). Por eso se usa `process.env` directamente aquí, que es la única excepción permitida a la regla de usar ConfigService.

## SchedulerModule

```typescript
@Module({
  imports: [
    DashboardModule,   // exporta DailyAggregatorService
    TelegramModule,    // exporta TelegramService
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
```

## Cron expressions de referencia

| Expression | Cuándo |
|---|---|
| `0 8 * * *` | 8:00 AM todos los días (default) |
| `0 8 * * 1-5` | 8:00 AM solo lunes a viernes |
| `0 7 * * 1-5` | 7:00 AM lunes a viernes |
| `*/5 * * * *` | Cada 5 minutos (para pruebas) |

## Test del cron en desarrollo

Para verificar que el mensaje llega sin esperar las 8 AM, cambiar temporalmente el cron a cada minuto:

```bash
MORNING_DIGEST_CRON="* * * * *"  # en .env local
```

O exponer un endpoint de disparo manual (solo en desarrollo):

```typescript
// Solo en desarrollo — NO incluir en producción
@Post('api/scheduler/trigger')
async triggerManual(): Promise<DailyDigest> {
  const digest = await this.aggregator.buildDailyDigest();
  await this.telegram.sendMorningDigest(digest);
  return digest;
}
```

## Test unitario (scheduler.service.spec.ts)

Casos a cubrir:
- `runMorningDigest` llama a `aggregator.buildDailyDigest()` y luego `telegram.sendMorningDigest()`
- Si `aggregator` lanza error → el método no relanza (catch interno)
- Si `telegram` lanza error → el método no relanza
