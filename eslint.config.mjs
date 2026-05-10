import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next, extended with ** so nested
    // build outputs (inside git worktrees) are also ignored.
    "**/.next/**",
    // E2E test runs produce sibling .next-e2e* dirs full of compiled output;
    // scanning them yielded thousands of phantom errors locally.
    "**/.next-e2e*/**",
    "**/out/**",
    "**/build/**",
    "next-env.d.ts",
    // Isolated git worktrees — never lint these.
    ".claude/worktrees/**",
    ".worktrees/**",
    // Submodule of the wasm search engine — its `pkg/` ships
    // wasm-bindgen-generated JS that intentionally violates a few of
    // our lint rules (and we have no control over the output).
    "vendor/**",
    // Auto-generated wasm bindings copied into public/ for the runtime.
    "public/wasm/**",
  ]),
]);

export default eslintConfig;
