import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { ProblemDetailsFilter } from "./common/problem-details.filter.js";
import { env } from "./config/env.js";
import { runMigrations } from "./database/database.module.js";

async function bootstrap() {
  await runMigrations();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set("trust proxy", true);
  if (env.APP_ENV === "development") app.enableCors({ origin: true });
  app.setGlobalPrefix("v1");
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(env.PORT);
}
await bootstrap();
