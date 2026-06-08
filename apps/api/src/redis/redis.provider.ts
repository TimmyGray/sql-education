import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis as UpstashRedis } from "@upstash/redis";
import IORedisCtor from "ioredis";
import { REDIS_CLIENT, RedisClientLike } from "./redis.constants";

/**
 * Wraps an Upstash HTTP client to match the RedisClientLike interface that the
 * rest of the app expects (ioredis-shaped API). Upstash uses {ex: n} for TTL
 * while ioredis uses ("EX", n), and its del/exists return values differ slightly.
 */
class UpstashAdapter implements RedisClientLike {
  constructor(private readonly client: UpstashRedis) {}

  async set(
    key: string,
    value: string,
    _mode: "EX",
    ttlSeconds: number,
  ): Promise<unknown> {
    return this.client.set(key, value, { ex: ttlSeconds });
  }

  async get(key: string): Promise<string | null> {
    const result = String(await this.client.get<string>(key));
    return result === "null" ? null : result;
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async exists(...keys: string[]): Promise<number> {
    return this.client.exists(...keys);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async quit(): Promise<unknown> {
    // Upstash is HTTP-based — no persistent connection to close.
    return "OK";
  }
}

export const redisClientProvider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): RedisClientLike => {
    const logger = new Logger("RedisModule");

    const cloudUrl = config.get<string>("REDIS_CLOUD_URL");
    const cloudToken = config.get<string>("REDIS_CLOUD_TOKEN");

    if (cloudUrl && cloudToken) {
      logger.log("Using Upstash Redis (cloud)");
      return new UpstashAdapter(
        new UpstashRedis({ url: cloudUrl, token: cloudToken }),
      );
    }

    const localUrl =
      config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    logger.log(`Using local Redis at ${localUrl}`);

    const client = new IORedisCtor(localUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
    client.on("error", (err: Error) => {
      logger.error(`Redis client error: ${err.message}`);
    });
    return client as unknown as RedisClientLike;
  },
};
