/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  roots: ["<rootDir>/src"],
  moduleNameMapper: {
    // CSS / asset stubs.
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    // Path alias.
    "^@/(.*)$": "<rootDir>/src/$1",
    // Resolve workspace contracts to its built CJS bundle.
    "^@sql-edu/contracts$": "<rootDir>/../../packages/contracts/dist/index.js",
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          esModuleInterop: true,
          allowJs: true,
        },
      },
    ],
  },
  testMatch: ["<rootDir>/src/**/*.(spec|test).(ts|tsx)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  collectCoverageFrom: [
    "src/**/*.(ts|tsx)",
    // Exclude test files, type-only declarations, and barrels.
    "!src/**/*.(spec|test).(ts|tsx)",
    "!src/**/*.d.ts",
    "!src/**/index.(ts|tsx)",
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
