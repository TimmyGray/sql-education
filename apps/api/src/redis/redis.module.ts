import { Global, Module } from "@nestjs/common";
import { REDIS_CLIENT } from "./redis.constants";
import { redisClientProvider } from "./redis.provider";
import { RedisService } from "./redis.service";

@Global()
@Module({
  providers: [redisClientProvider, RedisService],
  exports: [RedisService, REDIS_CLIENT],
})
export class RedisModule {}
