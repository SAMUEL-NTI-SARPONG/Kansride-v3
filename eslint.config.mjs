import js from '@eslint/js';
import tseslintPlugin from '@typescript-eslint/eslint-plugin';

// Flat config for the KansRide monorepo (ESLint 9).
// Replaces the legacy `.eslintrc.json` (eslintrc v8 format), which ESLint 9
// no longer loads. A single root config governs every workspace: when a
// workspace runs `eslint .`, ESLint walks up to this file.
//
// The TypeScript plugin/parser are wired via the plugin's `flat/recommended`
// export, which is already flat-config shaped (parser + rules wired up). We
// reuse the already-installed `@typescript-eslint/eslint-plugin` and
// `@eslint/js` packages rather than adding the `typescript-eslint` umbrella,
// to keep dependency churn minimal for the Phase 0A lint migration.

// globals for CommonJS tooling configs (next.config.js, postcss.config.js,
// tailwind.config.js, metro.config.js, ...). These files use module/require
// semantics; ESLint 9's flat config has no built-in `node` env, so the
// environment is declared explicitly rather than relying on `--env=node`.
const COMMONJS_NODE_GLOBALS = {
  module: 'readonly',
  require: 'readonly',
  exports: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  global: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
};

export default [
  {
    // Generated / vendored paths that should never be linted. Patterns are
    // anchored via `**/` prefixes so they cover every workspace's build
    // output (e.g. apps/*/.next, packages/*/dist). `next-env.d.ts` is
    // Next.js-generated "do not edit" content and is excluded by policy.
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.expo/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      '**/next-env.d.ts',
      '.qoder/**',
      'opencode.backup.json',
    ],
  },
  js.configs.recommended,
  ...tseslintPlugin.configs['flat/recommended'],
  {
    // CommonJS tooling configs (next/postcss/tailwind/metro). Provide Node
    // globals and relax TS-plugin rules that don't apply to plain JS. The
    // plugin's `flat/recommended` rules block ships without a `files` filter,
    // so its TS-specific rules would otherwise also surface on these `.js`
    // configs (e.g. `no-require-imports` on `metro.config.js`).
    files: ['**/*.{js,cjs}'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: COMMONJS_NODE_GLOBALS,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
  {
    // Preserve the rule tuning from the legacy .eslintrc.json so the migration
    // is behavior-preserving for the existing surface.
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];