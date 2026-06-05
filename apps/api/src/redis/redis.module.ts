import { Global, Module, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { REDIS_CLIENT, RedisClientLike } from "./redis.constants";
import { RedisService } from "./redis.service";

/**
 * Global Redis module.
 *
 * Provides a single, lazily-connecting ioredis client under {@link REDIS_CLIENT}
 * and the {@link RedisService} wrapper. Marked `@Global` so AuthModule (and any
 * future consumer) can inject `RedisService` without re-importing.
 *
 * The client uses `lazyConnect` so constructing the module never opens a socket
 * at import time — the connection is established on first command. Tests never
 * hit this factory; they override the `RedisService` provider with a fake.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RedisClientLike => {
        const url = config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
        const client = new Redis(url, {
          lazyConnect: true,
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
        });
        client.on("error", (err: Error) => {
          new Logger("RedisModule").error(
            `Redis client error: ${err.message}`,
          );
        });
        return client as unknown as RedisClientLike;
      },
    },
    RedisService,
  ],
  exports: [RedisService, REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor() {}

  /**
   * Best-effort graceful shutdown. Resolved lazily so the module has no hard
   * constructor dependency on the raw client (keeps the provider list simple).
   */
  async onModuleDestroy(): Promise<void> {
    // The raw client is closed by ioredis on process exit; nothing required
    // here beyond allowing Nest's lifecycle to settle. Kept for clarity/future.
  }
}
