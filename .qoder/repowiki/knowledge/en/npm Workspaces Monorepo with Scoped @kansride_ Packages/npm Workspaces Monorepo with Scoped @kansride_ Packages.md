---
kind: dependency_management
name: npm Workspaces Monorepo with Scoped @kansride/* Packages
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - packages/shared-types/package.json
    - packages/shared-config/package.json
    - packages/shared-db/package.json
    - packages/shared-auth/package.json
    - apps/backend/package.json
    - apps/admin-web/package.json
    - apps/mobile-driver/package.json
    - apps/tracking-web/package.json
---

The KansRide monorepo manages dependencies through npm workspaces, centralizing shared code and third-party libraries across multiple apps and packages under a single package-lock.json at the repository root.

Workspace layout: The root package.json declares workspaces as [packages/*, apps/*], which groups all sub-projects into one dependency graph. Every workspace package is marked private: true, so nothing is published to an external registry; cross-package references use the local workspace resolution.

Scoped internal packages: Shared code lives in packages/ and follows the @kansride/<name> naming convention:
- @kansride/types: shared TypeScript interfaces (built via tsc, exposes both main and types entry points plus an exports map for type-first consumption)
- @kansride/config: Zod-based runtime config, depends on @kansride/types
- @kansride/db: Drizzle ORM + PostgreSQL client, no build step (main/types point directly at src/index.ts)
- @kansride/auth: JWT utilities, also source-only
- @kansride/design-system (UI): referenced by mobile apps

Cross-package dependency usage: Apps consume these packages via bare scoped names with the wildcard version specifier *, e.g. "@kansride/types": "*". Because of workspaces, npm resolves this to the local package rather than the public registry. This pattern appears consistently in apps/backend, apps/admin-web, apps/mobile-driver, etc.

Versioning strategy: Internal packages are pinned at 0.1.0 and never published. External dependencies use caret ranges (^x.y.z) allowing minor/patch upgrades within the same major version. There is no lockfile override or overrides field in the root manifest, so npm hoists and deduplicates dependencies automatically.

Build and tooling integration: Each package defines its own build script (typically tsc or framework-specific commands like nest build / next build). The root scripts (build, test, lint, clean) forward to every workspace via --workspaces --if-present. Node engine is constrained to >=22.0.0 via the root engines field and .nvmrc.

No vendoring or private registry: There is no vendor/ directory, no .npmrc configuring a private registry, and no pnpm-lock.yaml / yarn.lock; only package-lock.json is present. Dependencies are installed from the public npm registry.