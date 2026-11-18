const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/**
 * ESM-only dependencies that Jest must transform instead of skipping.
 *
 * `next/jest` injects its own `transformIgnorePatterns` that ignore everything
 * under `node_modules` except `geist` and `.pnpm`. Jest skips a file when it
 * matches ANY pattern, so simply appending to that list can never re-include a
 * package — which is why importing `lenis` blew up with
 * "SyntaxError: Unexpected token 'export'".
 *
 * The patterns below are therefore applied *after* Next's config resolves, and
 * are written to match both POSIX (`/`) and Windows (`\`) separators.
 */
const ESM_ALLOWLIST = [
  "geist",
  "lenis",
  "gsap",
  "react-markdown",
  "remark-gfm",
  "unified",
  "bail",
  "is-plain-obj",
  "trough",
  "vfile",
  "unist-util-stringify-position",
  "mdast-util-from-markdown",
  "mdast-util-to-string",
  "micromark",
  "decode-named-entity-reference",
  "character-entities",
  "character-reference-invalid",
  "character-entities-legacy",
  "markdown-table",
  "escape-string-regexp",
  "longest-streak",
  "gemoji",
  "ccount",
].join("|");

const TRANSFORM_IGNORE_PATTERNS = [
  "[/\\\\]node_modules[/\\\\](?!(" + ESM_ALLOWLIST + ")[/\\\\])",
  "^.+\\.module\\.(css|sass|scss)$",
];

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
  transformIgnorePatterns: TRANSFORM_IGNORE_PATTERNS,
};

module.exports = async () => {
  const config = await createJestConfig(customJestConfig)();
  // Override the patterns Next injected so the allowlist above actually wins.
  config.transformIgnorePatterns = TRANSFORM_IGNORE_PATTERNS;
  return config;
};
