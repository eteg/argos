import "reflect-metadata";
import { startTracing } from "./tracing";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ProblemFilter } from "./problem.filter";
import { runMigrations } from "./db/db";

async function bootstrap() {
  startTracing();
  await runMigrations();
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix("v1");
  app.useGlobalFilters(new ProblemFilter());
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3001));
}

void bootstrap();
