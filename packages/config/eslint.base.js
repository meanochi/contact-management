// @ts-check
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";

/** Shared flat-config base — each package's own eslint.config.js spreads this
 * array and appends anything package-specific (e.g. React/Next or NestJS rules). */
export const baseConfig = [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  prettierConfig,
  {
    ignores: ["dist/**", ".next/**", ".turbo/**", "node_modules/**", "**/generated/**"],
  },
];

export default baseConfig;
