/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\.test\.ts$",
  moduleFileExtensions: ["js", "json", "ts"],
  // Transpile-only (isolatedModules); type-checking is done by `tsc`.
  transform: { "^.+\.ts$": ["ts-jest", { tsconfig: "<rootDir>/../tsconfig.spec.json" }] },
};
