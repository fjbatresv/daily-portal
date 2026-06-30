import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfiguration } from '../../config/configuration';

/**
 * Minimal cache contract used by external integration services.
 */
export interface ICacheService {
  /**
   * Reads and deserializes a cached value, returning null for missing keys.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Serializes and stores a value with its key-specific TTL in seconds.
   */
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;

  /**
   * Removes a cached value when callers need to force a refresh.
   */
  del(key: string): Promise<void>;
}

/**
 * Wraps the Redis client behind typed JSON helpers and NestJS lifecycle hooks.
 */
@Injectable()
export class CacheService implements ICacheService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client?: Redis;

  constructor(private readonly config: ConfigService<AppConfiguration, true>) {}

  /**
   * Opens the Redis connection using the centralized application config.
   */
  onModuleInit(): void {
    const redisUrl = this.config.getOrThrow('redis.url', { infer: true });
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis cache error: ${error.message}`, error.stack);
    });
  }

  /**
   * Closes the Redis connection when NestJS shuts down.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  /**
   * Reads and deserializes a cached JSON value, returning null for cache misses.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const rawValue = await this.redis.get(key);

      if (rawValue === null) {
        return null;
      }

      return JSON.parse(rawValue) as T;
    } catch (error) {
      this.logCacheError('get', key, error);
      return null;
    }
  }

  /**
   * Serializes and stores a value with a TTL in seconds.
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logCacheError('set', key, error);
    }
  }

  /**
   * Deletes a cached value by key.
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logCacheError('delete', key, error);
    }
  }

  private get redis(): Redis {
    if (!this.client) {
      throw new Error('CacheService has not been initialized');
    }

    return this.client;
  }

  private logCacheError(operation: 'delete' | 'get' | 'set', key: string, error: unknown): void {
    this.logger.error(
      `Redis cache ${operation} failed for key "${key}"`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}
