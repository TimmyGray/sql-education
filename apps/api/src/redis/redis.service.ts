import { Inject, Injectable, Logger } from "@nestjs/common";
import { REDIS_CLIENT, RedisClientLike } from "./redis.constants";

/**
 * Thin, intention-revealing wrapper over the ioredis client. Feature code
 * (AuthService) depends on this service rather than ioredis directly so the
 * transport is easy to fake in unit tests.
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly client: RedisClientLike,
  ) {}

  /** Set `key` => `value` with an expiry of `ttlSeconds` seconds. */
  async setWithTtl(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    this.logger.debug(`setWithTtl: ${key} (ttl ${ttlSeconds}s)`);
    await this.client.set(key, value, "EX", ttlSeconds);
  }

  /** Get the value at `key`, or `null` if missing/expired. */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** Delete one or more keys; returns the number of keys removed. */
  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    this.logger.debug(`del: ${keys.join(", ")}`);
    return this.client.del(...keys);
  }

  /** Atomically increment the integer at `key`; returns the new value. */
  async incr(key: string): Promise<number> {
    const value = await this.client.incr(key);
    this.logger.debug(`incr: ${key} -> ${value}`);
    return value;
  }

  /** Whether `key` currently exists (truthy when present). */
  async exists(key: string): Promise<boolean> {
    const n = await this.client.exists(key);
    return n > 0;
  }

  /** Remaining TTL of `key` in seconds (-2 missing, -1 no expiry per Redis). */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }
}
