const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import("jest").Config} */
const customJestConfig = {
  testEnvironment: "jest-environment-jsdom",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/.next/**",
    "!**/coverage/**",
    "!**/dist/**",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!(react-markdown|remark-gfm|unified|bail|is-plain-obj|trough|vfile|unist-util-stringify-position|mdast-util-from-markdown|mdast-util-to-string|micromark|decode-named-character-reference|character-entities|character-reference-invalid|character-entities-legacy|markdown-table|escape-string-regexp|longest-streak|gemoji|ccount)/)",
  ],
};

module.exports = createJestConfig(customJestConfig);
