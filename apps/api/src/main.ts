import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ZodValidationPipe } from "nestjs-zod";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Cookie parsing — the refresh token is delivered as an httpOnly cookie, so
  // feature waves read it from `req.cookies`.
  app.use(cookieParser());

  // CORS for the web origin; credentials enabled so the refresh cookie travels
  // with cross-origin requests from the Next.js app.
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });

  // Global validation via nestjs-zod. DTOs created with `createZodDto` from
  // @sql-edu/contracts schemas are validated automatically.
  app.useGlobalPipes(new ZodValidationPipe());

  // Swagger / OpenAPI docs at /docs.
  const config = new DocumentBuilder()
    .setTitle("SQL Education API")
    .setDescription("API for the SQL Education platform")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = Number(process.env.API_PORT) || 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
