---
kind: build_system
name: npm Workspaces Monorepo Build System
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - tsconfig.base.json
    - .github/workflows/ci.yml
    - apps/backend/package.json
    - apps/admin-web/package.json
    - packages/shared-types/package.json
---

The KansRide monorepo uses npm workspaces as its build and dependency management system, with TypeScript compilation per workspace and GitHub Actions for CI. There is no Makefile, Dockerfile, or custom shell-based build orchestration — the entire pipeline is driven by package.json scripts and npm's built-in workspace commands.

Core approach:
- Workspace layout: packages/* (shared libraries: @kansride/types, @kansride/config, @kansride/db, @kansride/auth, @kansride/ui) and apps/* (admin-web, backend, mobile-driver, mobile-passenger, tracking-web).
- Root orchestrator: package.json exposes build, test, lint, type-check, and clean that delegate via npm run <script> --workspaces --if-present.
- TypeScript: Each package declares its own tsc or framework-specific build (nest build, next build). The root tsconfig.base.json centralizes compiler flags (target: ES2022, module: ESNext, strict, composite, declaration, sourceMap) and path aliases mapping @kansride/* to packages/*/src/index.ts.
- Dependency resolution: Packages depend on each other via workspace protocol (@kansride/types: *), so npm ci hoists a single deduplicated dependency tree across all workspaces.

Per-app build tooling:
- @kansride/backend (NestJS): nest build -> dist/main.js; depends on all four shared packages.
- @kansride/admin-web, @kansride/tracking-web (Next.js 15): next build; uses Tailwind + PostCSS.
- @kansride/mobile-* (Expo/React Native): Metro bundler present but not wired into root build.
- Shared packages: tsc emitting dist/ with .js + .d.ts + declaration maps.

CI pipeline (.github/workflows/ci.yml):
1. lint-and-typecheck — installs deps, runs npm run lint and npm run type-check across all workspaces.
2. build-packages — builds shared packages in dependency order: shared-types -> shared-config -> shared-db -> shared-auth.
3. build-backend — spins up PostGIS 16 + Redis 7 services, sets DATABASE_URL / REDIS_URL, then builds @kansride/backend.
4. build-web — builds both Next.js apps (@kansride/admin-web, @kansride/tracking-web).
Jobs are chained via needs: so downstream builds only run after upstream stages pass. Node version is pinned to 24 in CI but constrained to >=22.0.0 via engines.node in the root manifest.

Conventions developers should follow:
- Add a build script to any new workspace if it needs to be included in the root npm run build or CI.
- Use workspace protocol (@kansride/<pkg>: *) to reference sibling packages rather than local file paths.
- Extend tsconfig.base.json from each workspace's tsconfig.json to keep compiler options consistent.
- Do not add top-level build scripts — route everything through package.json scripts so --workspaces can discover them automatically.