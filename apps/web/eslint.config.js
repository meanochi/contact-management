import { baseConfig } from "@contact-management/config/eslint.base.js";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  ...baseConfig,
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    ignores: [".next/**"],
  },
];
