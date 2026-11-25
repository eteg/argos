import { Global, Module } from "@nestjs/common";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

export const DB = Symbol("DB");
export type Database = NodePgDatabase<typeof schema> & { $client: pg.Pool };

export async function runMigrations() {
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: (): Database =>
        drizzle(new pg.Pool({ connectionString: env.DATABASE_URL }), { schema }),
    },
  ],
  exports: [DB],
})
export class DatabaseModule {}
