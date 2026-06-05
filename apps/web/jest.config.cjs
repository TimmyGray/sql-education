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
};
