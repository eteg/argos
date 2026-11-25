import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ProblemFilter } from "./problem.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix("v1");
  app.useGlobalFilters(new ProblemFilter());
  await app.listen(Number(process.env.PORT ?? 3001));
}

void bootstrap();
