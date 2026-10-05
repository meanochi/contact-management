// .mjs — see apps/api/eslint.config.mjs for why (this package is CommonJS too).
import { baseConfig } from "@contact-management/config/eslint.base.js";

export default [
  ...baseConfig,
  {
    ignores: ["src/generated/**"],
  },
];
