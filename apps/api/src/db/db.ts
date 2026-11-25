import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { join } from "node:path";
import { Pool } from "pg";
import * as schema from "./schema";

export const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });

// As migrations rodam quando a API sobe (ADR 0001).
export function runMigrations() {
  return migrate(db, { migrationsFolder: join(__dirname, "../../drizzle") });
}
