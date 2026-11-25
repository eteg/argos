import { defineConfig } from "eslint/config";
import globals from "globals";
import base from "../../eslint.config.mjs";

export default defineConfig([
  ...base,
  {
    rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
  {
    languageOptions: {
      globals: globals.node,
    },
  },
]);
