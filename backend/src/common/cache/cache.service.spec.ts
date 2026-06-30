import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import * as cacheExports from './index';
import { CacheModule } from './cache.module';
import { CacheService } from './cache.service';

type RedisMock = {
  get: jest.Mock<Promise<string | null>, [string]>;
  set: jest.Mock<Promise<'OK'>, [string, string, 'EX', number]>;
  del: jest.Mock<Promise<number>, [string]>;
  quit: jest.Mock<Promise<'OK'>, []>;
  on: jest.Mock<RedisMock, [string, (error: Error) => void]>;
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('CacheService', () => {
  const redisConstructor = jest.mocked(Redis);
  let redisClient: RedisMock;
  let service: CacheService;
  let loggerErrorSpy: jest.SpiedFunction<Logger['error']>;

  beforeEach(async () => {
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    redisClient = {
      get: jest.fn<Promise<string | null>, [string]>(),
      set: jest.fn<Promise<'OK'>, [string, string, 'EX', number]>(),
      del: jest.fn<Promise<number>, [string]>(),
      quit: jest.fn<Promise<'OK'>, []>(),
      on: jest.fn<RedisMock, [string, (error: Error) => void]>(),
    };
    redisClient.on.mockReturnValue(redisClient);
    redisConstructor.mockReturnValue(redisClient as unknown as Redis);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'redis.url') {
                return 'redis://localhost:6379';
              }

              throw new Error(`Unexpected config key: ${key}`);
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(CacheService);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('opens Redis with the configured URL and registers an error handler', () => {
    service.onModuleInit();

    expect(redisConstructor).toHaveBeenCalledWith('redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    expect(redisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('returns null when a key is missing', async () => {
    service.onModuleInit();
    redisClient.get.mockResolvedValue(null);

    await expect(service.get<{ ok: boolean }>('missing')).resolves.toBeNull();
    expect(redisClient.get).toHaveBeenCalledWith('missing');
  });

  it('deserializes cached JSON values', async () => {
    service.onModuleInit();
    redisClient.get.mockResolvedValue(JSON.stringify({ ok: true }));

    await expect(service.get<{ ok: boolean }>('test')).resolves.toEqual({ ok: true });
  });

  it('returns null when Redis get fails', async () => {
    service.onModuleInit();
    redisClient.get.mockRejectedValue(new Error('Redis unavailable'));

    await expect(service.get<{ ok: boolean }>('test')).resolves.toBeNull();
  });

  it('returns null when cached JSON cannot be parsed', async () => {
    service.onModuleInit();
    redisClient.get.mockResolvedValue('{bad-json');

    await expect(service.get<{ ok: boolean }>('test')).resolves.toBeNull();
  });

  it('serializes values with the provided TTL', async () => {
    service.onModuleInit();
    redisClient.set.mockResolvedValue('OK');

    await service.set('test', { ok: true }, 5);

    expect(redisClient.set).toHaveBeenCalledWith('test', '{"ok":true}', 'EX', 5);
  });

  it('swallows Redis set failures after logging', async () => {
    service.onModuleInit();
    redisClient.set.mockRejectedValue(new Error('Redis unavailable'));

    await expect(service.set('test', { ok: true }, 5)).resolves.toBeUndefined();
  });

  it('deletes cache keys', async () => {
    service.onModuleInit();
    redisClient.del.mockResolvedValue(1);

    await service.del('test');

    expect(redisClient.del).toHaveBeenCalledWith('test');
  });

  it('swallows Redis delete failures after logging', async () => {
    service.onModuleInit();
    redisClient.del.mockRejectedValue(new Error('Redis unavailable'));

    await expect(service.del('test')).resolves.toBeUndefined();
  });

  it('closes Redis on module destroy after initialization', async () => {
    service.onModuleInit();
    redisClient.quit.mockResolvedValue('OK');

    await service.onModuleDestroy();

    expect(redisClient.quit).toHaveBeenCalledTimes(1);
  });

  it('allows shutdown before initialization', async () => {
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('fails open when read before initialization', async () => {
    await expect(service.get('test')).resolves.toBeNull();
  });

  it('exports the cache module and service from the barrel', () => {
    expect(CacheModule).toBeDefined();
    expect(cacheExports.CacheModule).toBe(CacheModule);
    expect(cacheExports.CacheService).toBe(CacheService);
  });
});
