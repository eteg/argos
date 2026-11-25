import { defineConfig, globalIgnores } from "eslint/config";
import base from "../../eslint.config.mjs";

export default defineConfig([...base, globalIgnores(["src/schema.d.ts"])]);
