/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\.spec\.ts$",
  moduleFileExtensions: ["js", "json", "ts"],
  // Transpile-only (isolatedModules): ts-jest's type-checking mode can't
  // resolve NodeNext package "exports" subpaths (e.g. shared-schemas/contacts).
  // Type-checking is done by `tsc` (the typecheck script) instead.
  transform: { "^.+\.ts$": ["ts-jest", { tsconfig: "<rootDir>/../tsconfig.spec.json" }] },
};
