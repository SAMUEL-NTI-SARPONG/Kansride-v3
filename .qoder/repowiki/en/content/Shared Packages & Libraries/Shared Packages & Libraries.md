# Shared Packages & Libraries

<cite>
**Referenced Files in This Document**
- [package.json](file://package.json)
- [tsconfig.base.json](file://tsconfig.base.json)
- [.eslintrc.json](file://.eslintrc.json)
- [.prettierrc.json](file://.prettierrc.json)
- [ci.yml](file://.github/workflows/ci.yml)
- [README.md](file://README.md)
- [auth.guard.ts](file://apps/backend/src/common/guards/auth.guard.ts)
- [roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [permissions.decorator.ts](file://apps/backend/src/common/decorators/permissions.decorator.ts)
- [http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)
- [logging.interceptor.ts](file://apps/backend/src/common/interceptors/logging.interceptor.ts)
- [auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [auth.service.ts](file://apps/backend/src/modules/auth/auth.service.ts)
- [app.module.ts](file://apps/backend/src/app.module.ts)
- [main.ts](file://apps/backend/src/main.ts)
- [client.ts (mobile-passenger)](file://apps/mobile-passenger/src/api/client.ts)
- [client.ts (mobile-driver)](file://apps/mobile-driver/src/api/client.ts)
- [socket.ts (mobile-passenger)](file://apps/mobile-passenger/src/api/socket.ts)
- [socket.ts (mobile-driver)](file://apps/mobile-driver/src/api/socket.ts)
- [auth-store.ts (mobile-passenger)](file://apps/mobile-passenger/src/stores/auth-store.ts)
- [auth-store.ts (mobile-driver)](file://apps/mobile-driver/src/stores/auth-store.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document describes the shared packages and libraries used across the 18KansRide monorepo, focusing on design system components, styling tokens, reusable UI elements, shared authentication logic, configuration management, database utilities, common queries, migration helpers, and TypeScript type definitions. It also provides usage examples, contribution guidelines, versioning strategies, dependency management, and package publishing workflows. Where applicable, it references concrete source files to ground the guidance in the actual codebase.

## Project Structure
The repository is a monorepo with multiple applications under apps/ and shared packages under packages/. The root contains tooling and configuration shared by all apps and packages.

```mermaid
graph TB
subgraph "Root"
R1["package.json"]
R2["tsconfig.base.json"]
R3[".eslintrc.json"]
R4[".prettierrc.json"]
R5[".github/workflows/ci.yml"]
end
subgraph "Apps"
A1["apps/admin-web"]
A2["apps/tracking-web"]
A3["apps/backend"]
A4["apps/mobile-passenger"]
A5["apps/mobile-driver"]
end
subgraph "Packages"
P1["packages/design-system"]
P2["packages/shared-auth"]
P3["packages/shared-config"]
P4["packages/shared-db"]
P5["packages/shared-types"]
end
R1 --> A1
R1 --> A2
R1 --> A3
R1 --> A4
R1 --> A5
R1 --> P1
R1 --> P2
R1 --> P3
R1 --> P4
R1 --> P5
A3 --> P2
A3 --> P3
A3 --> P4
A3 --> P5
A1 --> P1
A1 --> P5
A2 --> P1
A2 --> P5
A4 --> P2
A4 --> P3
A4 --> P5
A5 --> P2
A5 --> P3
A5 --> P5
```

**Diagram sources**
- [package.json](file://package.json)
- [tsconfig.base.json](file://tsconfig.base.json)
- [ci.yml](file://.github/workflows/ci.yml)

**Section sources**
- [package.json](file://package.json)
- [tsconfig.base.json](file://tsconfig.base.json)
- [README.md](file://README.md)

## Core Components
This section outlines the shared packages and their responsibilities:

- Design System (packages/design-system): Centralized UI components, tokens, and theming for consistent user experiences across web apps.
- Shared Auth (packages/shared-auth): Common authentication logic, guards, and utilities for both backend and mobile clients.
- Shared Config (packages/shared-config): Environment-specific settings and configuration loaders.
- Shared DB (packages/shared-db): Database utilities, common queries, and migration helpers.
- Shared Types (packages/shared-types): TypeScript types and interfaces consumed by all apps and packages.

Usage patterns:
- Backend consumes shared-auth, shared-config, shared-db, and shared-types.
- Web apps consume design-system and shared-types; they may also use shared-config for environment variables.
- Mobile apps consume shared-auth, shared-config, and shared-types for API client setup and state management.

**Section sources**
- [package.json](file://package.json)
- [tsconfig.base.json](file://tsconfig.base.json)

## Architecture Overview
The shared packages provide cross-cutting concerns that are reused by multiple applications. The following diagram shows how the backend integrates with shared modules and how mobile apps interact with shared auth and config.

```mermaid
graph TB
subgraph "Backend"
BMain["main.ts"]
BApp["app.module.ts"]
BAuthCtrl["auth.controller.ts"]
BAuthService["auth.service.ts"]
BGuards["guards: auth.guard.ts, roles.guard.ts"]
BDecorators["decorators: permissions.decorator.ts"]
BFilters["filters: http-exception.filter.ts"]
BInterceptors["interceptors: logging.interceptor.ts"]
end
subgraph "Shared Packages"
SAuth["shared-auth"]
SConfig["shared-config"]
SDB["shared-db"]
STypes["shared-types"]
end
subgraph "Mobile Apps"
MPassClient["mobile-passenger api/client.ts"]
MDriverClient["mobile-driver api/client.ts"]
MPassSocket["mobile-passenger api/socket.ts"]
MDriverSocket["mobile-driver api/socket.ts"]
MPassStore["mobile-passenger stores/auth-store.ts"]
MDriverStore["mobile-driver stores/auth-store.ts"]
end
BMain --> BApp
BApp --> BAuthCtrl
BAuthCtrl --> BAuthService
BApp --> BGuards
BApp --> BDecorators
BApp --> BFilters
BApp --> BInterceptors
BAuthService --> SAuth
BApp --> SConfig
BApp --> SDB
BApp --> STypes
MPassClient --> SAuth
MDriverClient --> SAuth
MPassSocket --> SAuth
MDriverSocket --> SAuth
MPassStore --> SAuth
MDriverStore --> SAuth
```

**Diagram sources**
- [main.ts](file://apps/backend/src/main.ts)
- [app.module.ts](file://apps/backend/src/app.module.ts)
- [auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [auth.service.ts](file://apps/backend/src/modules/auth/auth.service.ts)
- [auth.guard.ts](file://apps/backend/src/common/guards/auth.guard.ts)
- [roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [permissions.decorator.ts](file://apps/backend/src/common/decorators/permissions.decorator.ts)
- [http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)
- [logging.interceptor.ts](file://apps/backend/src/common/interceptors/logging.interceptor.ts)
- [client.ts (mobile-passenger)](file://apps/mobile-passenger/src/api/client.ts)
- [client.ts (mobile-driver)](file://apps/mobile-driver/src/api/client.ts)
- [socket.ts (mobile-passenger)](file://apps/mobile-passenger/src/api/socket.ts)
- [socket.ts (mobile-driver)](file://apps/mobile-driver/src/api/socket.ts)
- [auth-store.ts (mobile-passenger)](file://apps/mobile-passenger/src/stores/auth-store.ts)
- [auth-store.ts (mobile-driver)](file://apps/mobile-driver/src/stores/auth-store.ts)

## Detailed Component Analysis

### Shared Authentication Module
Responsibilities:
- Provide common authentication flows (login, token handling).
- Implement guards and decorators for authorization.
- Offer utilities for token validation and session management.

Backend integration points:
- Guards enforce authentication and role-based access control.
- Decorators simplify permission checks on controllers.
- Filters standardize HTTP exception responses.
- Interceptors add cross-cutting behavior like logging.

```mermaid
sequenceDiagram
participant Client as "Mobile/Web Client"
participant Controller as "auth.controller.ts"
participant Service as "auth.service.ts"
participant Guard as "auth.guard.ts"
participant Roles as "roles.guard.ts"
participant Decorator as "permissions.decorator.ts"
participant Filter as "http-exception.filter.ts"
participant Interceptor as "logging.interceptor.ts"
Client->>Controller : "POST /auth/login"
Controller->>Service : "authenticate(credentials)"
Service-->>Controller : "tokens/user info"
Controller-->>Client : "response with tokens"
Note over Guard,Decorator : "Protected routes validated via guards and decorators"
Client->>Controller : "GET /protected-resource"
Controller->>Guard : "validate request"
Guard->>Roles : "check roles"
Roles->>Decorator : "apply permissions"
Controller->>Interceptor : "log request"
Interceptor-->>Controller : "continue"
Controller-->>Client : "authorized response"
Note over Filter : "Errors normalized via HTTP exception filter"
```

**Diagram sources**
- [auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [auth.service.ts](file://apps/backend/src/modules/auth/auth.service.ts)
- [auth.guard.ts](file://apps/backend/src/common/guards/auth.guard.ts)
- [roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [permissions.decorator.ts](file://apps/backend/src/common/decorators/permissions.decorator.ts)
- [http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)
- [logging.interceptor.ts](file://apps/backend/src/common/interceptors/logging.interceptor.ts)

**Section sources**
- [auth.guard.ts](file://apps/backend/src/common/guards/auth.guard.ts)
- [roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [permissions.decorator.ts](file://apps/backend/src/common/decorators/permissions.decorator.ts)
- [http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)
- [logging.interceptor.ts](file://apps/backend/src/common/interceptors/logging.interceptor.ts)
- [auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [auth.service.ts](file://apps/backend/src/modules/auth/auth.service.ts)

### Configuration Management System
Purpose:
- Load environment-specific settings for backend and mobile apps.
- Provide typed configuration objects consumed by services and clients.

Integration points:
- Backend module initialization uses configuration values.
- Mobile apps configure API clients and sockets using environment variables.

```mermaid
flowchart TD
Start(["App Startup"]) --> LoadEnv["Load environment variables"]
LoadEnv --> Validate["Validate required keys"]
Validate --> BuildConfig["Build typed config object"]
BuildConfig --> Inject["Inject into services/clients"]
Inject --> End(["Ready"])
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

**Section sources**
- [app.module.ts](file://apps/backend/src/app.module.ts)
- [client.ts (mobile-passenger)](file://apps/mobile-passenger/src/api/client.ts)
- [client.ts (mobile-driver)](file://apps/mobile-driver/src/api/client.ts)
- [socket.ts (mobile-passenger)](file://apps/mobile-passenger/src/api/socket.ts)
- [socket.ts (mobile-driver)](file://apps/mobile-driver/src/api/socket.ts)

### Database Utilities and Migration Helpers
Purpose:
- Provide reusable database operations and query builders.
- Standardize migrations and schema evolution.

Integration points:
- Backend services import shared-db utilities for common queries.
- Migrations are executed through shared helpers to ensure consistency.

```mermaid
flowchart TD
Init(["Service Initialization"]) --> Connect["Connect to database"]
Connect --> RunMigrations["Run migrations via helpers"]
RunMigrations --> UseQueries["Use shared query utilities"]
UseQueries --> End(["Operations Executed"])
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

**Section sources**
- [app.module.ts](file://apps/backend/src/app.module.ts)

### TypeScript Type Definitions
Purpose:
- Centralize shared types consumed by backend, web, and mobile apps.
- Ensure consistent contracts between services and clients.

Integration points:
- Backend modules import shared-types for DTOs and entities.
- Mobile apps import shared-types for API payloads and store models.

```mermaid
graph TB
TTypes["shared-types"]
TBackend["backend modules"]
TWeb["web apps"]
TMobile["mobile apps"]
TTypes --> TBackend
TTypes --> TWeb
TTypes --> TMobile
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

**Section sources**
- [tsconfig.base.json](file://tsconfig.base.json)

### Design System Components and Styling Tokens
Purpose:
- Provide reusable UI components, tokens, and theming for consistent visuals.
- Reduce duplication across admin-web and tracking-web.

Integration points:
- Web apps import design-system components and tokens.
- Tailwind configurations reference shared tokens where applicable.

```mermaid
graph TB
DSystem["design-system"]
AdminWeb["admin-web"]
TrackingWeb["tracking-web"]
DSystem --> AdminWeb
DSystem --> TrackingWeb
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

**Section sources**
- [tsconfig.base.json](file://tsconfig.base.json)

## Dependency Analysis
Monorepo-level dependencies and tooling:
- Root package.json defines workspace packages and scripts.
- tsconfig.base.json centralizes TypeScript compiler options.
- ESLint and Prettier configs standardize linting and formatting.
- CI pipeline automates builds and tests.

```mermaid
graph TB
RootPkg["package.json"]
TSBase["tsconfig.base.json"]
Lint[".eslintrc.json"]
Format[".prettierrc.json"]
CI[".github/workflows/ci.yml"]
RootPkg --> TSBase
RootPkg --> Lint
RootPkg --> Format
RootPkg --> CI
```

**Diagram sources**
- [package.json](file://package.json)
- [tsconfig.base.json](file://tsconfig.base.json)
- [.eslintrc.json](file://.eslintrc.json)
- [.prettierrc.json](file://.prettierrc.json)
- [ci.yml](file://.github/workflows/ci.yml)

**Section sources**
- [package.json](file://package.json)
- [tsconfig.base.json](file://tsconfig.base.json)
- [.eslintrc.json](file://.eslintrc.json)
- [.prettierrc.json](file://.prettierrc.json)
- [ci.yml](file://.github/workflows/ci.yml)

## Performance Considerations
- Prefer lazy loading of heavy shared packages in mobile apps to reduce bundle size.
- Cache frequently accessed configuration values at startup to avoid repeated IO.
- Use connection pooling and prepared statements in database utilities to minimize overhead.
- Apply memoization or caching layers around expensive shared computations.
- Keep shared-types minimal and focused to reduce compile times and bundle sizes.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Authentication failures: Verify guard and decorator wiring; ensure tokens are present and valid. Check HTTP exception filter for standardized error messages.
- Configuration errors: Validate environment variables at startup; confirm required keys exist and have correct formats.
- Database connectivity: Confirm connection parameters and run migrations before starting services.
- Type mismatches: Align shared-types with API contracts; update shared-types when backend schemas evolve.

Operational hooks:
- Logging interceptor can help trace request/response cycles.
- HTTP exception filter normalizes error responses for easier debugging.

**Section sources**
- [auth.guard.ts](file://apps/backend/src/common/guards/auth.guard.ts)
- [roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [permissions.decorator.ts](file://apps/backend/src/common/decorators/permissions.decorator.ts)
- [http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)
- [logging.interceptor.ts](file://apps/backend/src/common/interceptors/logging.interceptor.ts)

## Conclusion
The shared packages form the backbone of the 18KansRide monorepo, providing consistent authentication, configuration, database utilities, types, and UI components. By centralizing these concerns, the team ensures maintainability, reduces duplication, and accelerates feature development across backend, web, and mobile applications. Adhering to the contribution and publishing guidelines will keep the ecosystem stable and scalable.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Usage Examples
- Backend:
  - Import shared-auth guards and decorators to protect endpoints.
  - Use shared-config to load environment-specific settings.
  - Leverage shared-db utilities for common queries and migrations.
- Mobile:
  - Configure API client and socket with shared-config values.
  - Manage auth state using shared-auth utilities and stores.
- Web:
  - Consume design-system components and tokens for consistent UI.
  - Use shared-types for payload shapes and store models.

[No sources needed since this section provides general guidance]

### Contribution Guidelines
- Follow monorepo conventions: place shared logic in packages/, app-specific code in apps/.
- Maintain strict typing: define and export types from shared-types.
- Keep configuration centralized: add new env keys to shared-config and validate at startup.
- Write tests for shared utilities and guards to prevent regressions.
- Update documentation when introducing new shared APIs.

[No sources needed since this section provides general guidance]

### Versioning Strategies
- Semantic versioning for each shared package.
- Coordinate breaking changes across apps consuming shared packages.
- Publish changelogs and tag releases in CI.

[No sources needed since this section provides general guidance]

### Dependency Management and Publishing Workflows
- Define workspace dependencies in root package.json.
- Use CI pipeline to build, test, and publish packages.
- Pin versions in apps/packages to ensure reproducibility.
- Automate release notes and tags during publishing.

**Section sources**
- [package.json](file://package.json)
- [ci.yml](file://.github/workflows/ci.yml)