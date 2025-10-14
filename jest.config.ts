import { Config } from "@jest/types";

const baseTestDir = "<rootDir>/test";

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: [`${baseTestDir}/**/*.test.ts`],
  watchman: false,
  setupFiles: ["<rootDir>/test/jest.setup.ts"],
  collectCoverage: true,
  coverageDirectory: "<rootDir>/test/coverage",
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
};

export default config;
