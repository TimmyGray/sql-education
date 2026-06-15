/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  roots: ["<rootDir>/src"],
  moduleFileExtensions: ["js", "json", "ts"],
  testRegex: ".*\\.(spec|test)\\.ts$",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  moduleNameMapper: {
    // Resolve the workspace contracts package to its BUILT CJS output during
    // tests. (contracts is built first via turbo `^build`.)
    "^@sql-edu/contracts$": "<rootDir>/../../packages/contracts/dist/index.js",
  },
  collectCoverageFrom: [
    "src/**/*.(t|j)s",
    // Exclude declaration-only / wiring files with no testable logic.
    "!src/**/*.spec.ts",
    "!src/**/*.dto.ts",
    "!src/**/*.module.ts",
    "!src/**/index.ts",
    "!src/main.ts",
  ],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
