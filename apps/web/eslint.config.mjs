import nextVitals from "eslint-config-next/core-web-vitals";
import { defineConfig, globalIgnores } from "eslint/config";
import base from "../../eslint.config.mjs";

export default defineConfig([...base, ...nextVitals, globalIgnores(["src/app/sw.ts", "public/**"])]);
