/**
 * Injection token for the underlying ioredis client. Provided by
 * {@link RedisModule} via a factory and consumed by {@link RedisService}.
 *
 * Tests provide a fake against this token so no real Redis connection is made.
 */
export const REDIS_CLIENT = "REDIS_CLIENT";

/**
 * Minimal surface of ioredis that {@link RedisService} depends on. Declaring it
 * here (instead of importing ioredis' type) keeps the service trivially
 * mockable: a test fake only needs to satisfy this interface.
 */
export interface RedisClientLike {
  set(
    key: string,
    value: string,
    mode: "EX",
    ttlSeconds: number,
  ): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  ttl(key: string): Promise<number>;
  quit(): Promise<unknown>;
}
