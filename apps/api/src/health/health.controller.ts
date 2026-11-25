import { Controller, Get, Inject } from "@nestjs/common";
import type { Schemas } from "@argos/contract";
import { sql } from "drizzle-orm";
import { Public } from "../common/public.decorator.js";
import { ProblemException } from "../common/problem.js";
import { env } from "../config/env.js";
import { DB, type Database } from "../database/database.module.js";

const DATABASE_TIMEOUT_MS = 2000;

@Controller("health")
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Public()
  @Get()
  async getHealth(): Promise<Schemas["Health"]> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("database timeout")), DATABASE_TIMEOUT_MS).unref();
    });
    try {
      await Promise.race([this.db.execute(sql`select 1`), timeout]);
    } catch {
      throw new ProblemException(503, "UNAVAILABLE", "The database is not responding.");
    }
    return { status: "ok", environment: env.APP_ENV, version: env.GIT_COMMIT, database: "up" };
  }
}
