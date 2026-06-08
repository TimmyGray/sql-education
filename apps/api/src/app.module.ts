import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { CommonModule } from "./common/common.module";
import { validateEnv } from "./config/env.validation";
// Feature modules (Wave 1).
import { RedisModule } from "./redis/redis.module";
import { MailModule } from "./mail/mail.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ContentModule } from "./content/content.module";
import { StudyModule } from "./study/study.module";
import { AiModule } from "./ai/ai.module";

@Module({
  imports: [
    // Global config: root .env is the single source of truth. CWD at runtime
    // is apps/api/, so ../../.env resolves to the monorepo root. process.env
    // always wins (docker-compose overrides localhost URLs with service names).
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: '../../.env',
    }),

    // Basic rate limiting (defaults; individual routes/guards tune later).
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),

    // Global infrastructure modules.
    PrismaModule,
    HealthModule,
    // Shared auth kernel (guards/decorator) — global, available everywhere.
    CommonModule,

    // ========================================================================
    // === FEATURE MODULES (Wave 1) ===
    // Globals first (RedisModule/MailModule are @Global), then feature modules.
    // GradingModule + SandboxModule are pulled in transitively via StudyModule.
    RedisModule,
    MailModule,
    AuthModule,
    UsersModule,
    ContentModule,
    StudyModule,
    AiModule,
    // ========================================================================
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
