import nextVitals from "eslint-config-next/core-web-vitals";
import { defineConfig } from "eslint/config";
import base from "../../eslint.config.mjs";

export default defineConfig([...base, ...nextVitals]);
