// .mjs (not .js) so this always loads as ESM regardless of this package's
// own "type": "commonjs" — needed to import packages/config's ESM base
// (a CommonJS file cannot require() an ESM module synchronously).
import { baseConfig } from "@contact-management/config/eslint.base.js";

export default [
  ...baseConfig,
  {
    rules: {
      // NestJS decorators commonly need an empty constructor-injected class
      // with no other members — not a real "unused" signal here.
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },
];
