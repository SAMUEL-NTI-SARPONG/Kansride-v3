# Subscription Management

<cite>
**Referenced Files in This Document**
- [apps/admin-web/src/app/dashboard/subscriptions/page.tsx](file://apps/admin-web/src/app/dashboard/subscriptions/page.tsx)
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/backend/src/modules/users/users.controller.ts](file://apps/backend/src/modules/users/users.controller.ts)
- [apps/backend/src/modules/users/users.service.ts](file://apps/backend/src/modules/users/users.service.ts)
- [apps/backend/src/modules/auth/auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [apps/backend/src/modules/auth/auth.service.ts](file://apps/backend/src/modules/auth/auth.service.ts)
- [apps/backend/src/common/guards/roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [apps/backend/src/common/filters/http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)
- [apps/backend/src/main.ts](file://apps/backend/src/main.ts)
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
This document describes the subscription management system across admin, mobile driver, and backend layers. It covers:
- Subscription plan administration (admin UI)
- User subscription tracking (driver app)
- Billing oversight and revenue analytics (admin dashboard)
- Integration with payment processing systems (conceptual)
- Subscription lifecycle management and automated billing workflows (conceptual)
- Subscription tiers, promotional codes, and refund handling (conceptual)
- Examples of reporting, renewal management, and customer support tools (conceptual)

Where implementation details are not present in the codebase, this document provides conceptual guidance to help you extend the system.

## Project Structure
The subscription features span three main areas:
- Admin web application for managing subscriptions and viewing analytics
- Mobile driver application for users to view and manage their subscriptions
- Backend services providing authentication, user data access, and guard/filter infrastructure

```mermaid
graph TB
subgraph "Admin Web"
A["Dashboard Subscriptions Page"]
end
subgraph "Mobile Driver App"
B["Driver Subscription Screen"]
end
subgraph "Backend"
C["Auth Controller & Service"]
D["Users Controller & Service"]
E["Roles Guard"]
F["HTTP Exception Filter"]
G["App Bootstrap"]
end
A --> C
A --> D
B --> C
B --> D
C --> E
D --> E
C --> F
D --> F
G --> C
G --> D
```

**Diagram sources**
- [apps/admin-web/src/app/dashboard/subscriptions/page.tsx](file://apps/admin-web/src/app/dashboard/subscriptions/page.tsx)
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/backend/src/modules/auth/auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [apps/backend/src/modules/auth/auth.service.ts](file://apps/backend/src/modules/auth/auth.service.ts)
- [apps/backend/src/modules/users/users.controller.ts](file://apps/backend/src/modules/users/users.controller.ts)
- [apps/backend/src/modules/users/users.service.ts](file://apps/backend/src/modules/users/users.service.ts)
- [apps/backend/src/common/guards/roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [apps/backend/src/common/filters/http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)
- [apps/backend/src/main.ts](file://apps/backend/src/main.ts)

**Section sources**
- [apps/admin-web/src/app/dashboard/subscriptions/page.tsx](file://apps/admin-web/src/app/dashboard/subscriptions/page.tsx)
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/backend/src/modules/auth/auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [apps/backend/src/modules/auth/auth.service.ts](file://apps/backend/src/modules/auth/auth.service.ts)
- [apps/backend/src/modules/users/users.controller.ts](file://apps/backend/src/modules/users/users.controller.ts)
- [apps/backend/src/modules/users/users.service.ts](file://apps/backend/src/modules/users/users.service.ts)
- [apps/backend/src/common/guards/roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [apps/backend/src/common/filters/http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)
- [apps/backend/src/main.ts](file://apps/backend/src/main.ts)

## Core Components
- Admin Subscriptions Page: Provides a UI for subscription plan administration and analytics overview.
- Driver Subscription Screen: Allows drivers to view current subscription status, renewals, and related actions.
- Auth Module: Handles authentication flows and token-based authorization used by subscription endpoints.
- Users Module: Exposes user-related operations that can include subscription state retrieval and updates.
- Roles Guard: Enforces role-based access control on protected routes.
- HTTP Exception Filter: Centralizes error formatting and logging for API responses.
- App Bootstrap: Initializes guards, filters, and global configuration.

Key responsibilities:
- Admin UI orchestrates calls to backend endpoints for plan management and analytics.
- Driver UI reads user subscription state via authenticated requests.
- Backend enforces roles and returns structured responses.

**Section sources**
- [apps/admin-web/src/app/dashboard/subscriptions/page.tsx](file://apps/admin-web/src/app/dashboard/subscriptions/page.tsx)
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/backend/src/modules/auth/auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [apps/backend/src/modules/auth/auth.service.ts](file://apps/backend/src/modules/auth/auth.service.ts)
- [apps/backend/src/modules/users/users.controller.ts](file://apps/backend/src/modules/users/users.controller.ts)
- [apps/backend/src/modules/users/users.service.ts](file://apps/backend/src/modules/users/users.service.ts)
- [apps/backend/src/common/guards/roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [apps/backend/src/common/filters/http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)
- [apps/backend/src/main.ts](file://apps/backend/src/main.ts)

## Architecture Overview
High-level flow:
- Admin and driver clients authenticate via the auth module.
- Clients call user or subscription endpoints guarded by roles.
- Responses are normalized by the HTTP exception filter.
- The app bootstrap wires guards and filters globally.

```mermaid
sequenceDiagram
participant Admin as "Admin Web"
participant Driver as "Driver App"
participant Auth as "Auth Controller"
participant Users as "Users Controller"
participant Guard as "Roles Guard"
participant Filter as "HTTP Exception Filter"
Admin->>Auth : "Authenticate"
Auth-->>Admin : "Token"
Driver->>Auth : "Authenticate"
Auth-->>Driver : "Token"
Admin->>Guard : "Request /subscriptions"
Guard-->>Admin : "Allow/Deny"
Admin->>Users : "GET/POST subscription plans"
Users-->>Admin : "Plans + Analytics"
Driver->>Guard : "Request /users/me/subscription"
Guard-->>Driver : "Allow/Deny"
Driver->>Users : "GET subscription state"
Users-->>Driver : "Subscription details"
Note over Filter,Users : "Errors normalized here"
```

**Diagram sources**
- [apps/backend/src/modules/auth/auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [apps/backend/src/modules/users/users.controller.ts](file://apps/backend/src/modules/users/users.controller.ts)
- [apps/backend/src/common/guards/roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [apps/backend/src/common/filters/http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)

## Detailed Component Analysis

### Admin Subscriptions Page
Responsibilities:
- Display subscription plans and metrics
- Trigger administrative actions (create/update plans, view analytics)
- Integrate with backend endpoints for plan CRUD and reporting

Implementation notes:
- Uses Next.js page structure under dashboard/subscriptions
- Likely consumes REST endpoints exposed by the backend modules

```mermaid
flowchart TD
Start(["Open Admin Subscriptions"]) --> LoadData["Load Plans and Metrics"]
LoadData --> Actions{"User Action?"}
Actions --> |Create Plan| CreatePlan["Call Create Plan Endpoint"]
Actions --> |Update Plan| UpdatePlan["Call Update Plan Endpoint"]
Actions --> |View Analytics| ViewAnalytics["Fetch Analytics Data"]
CreatePlan --> Success["Show Success Feedback"]
UpdatePlan --> Success
ViewAnalytics --> RenderCharts["Render Charts/Tables"]
Success --> End(["Done"])
RenderCharts --> End
```

**Diagram sources**
- [apps/admin-web/src/app/dashboard/subscriptions/page.tsx](file://apps/admin-web/src/app/dashboard/subscriptions/page.tsx)

**Section sources**
- [apps/admin-web/src/app/dashboard/subscriptions/page.tsx](file://apps/admin-web/src/app/dashboard/subscriptions/page.tsx)

### Driver Subscription Screen
Responsibilities:
- Show current subscription status, expiry, and renewal options
- Provide actions to renew or upgrade subscription
- Reflect real-time changes after successful payments

Implementation notes:
- Located under mobile driver main layout
- Calls authenticated endpoints to retrieve and update subscription state

```mermaid
sequenceDiagram
participant Driver as "Driver App"
participant Auth as "Auth Controller"
participant Users as "Users Controller"
Driver->>Auth : "Login"
Auth-->>Driver : "Token"
Driver->>Users : "GET /users/me/subscription"
Users-->>Driver : "Current subscription"
Driver->>Users : "POST /users/me/subscription/renew"
Users-->>Driver : "Renewal result"
```

**Diagram sources**
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/backend/src/modules/auth/auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [apps/backend/src/modules/users/users.controller.ts](file://apps/backend/src/modules/users/users.controller.ts)

**Section sources**
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/backend/src/modules/auth/auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [apps/backend/src/modules/users/users.controller.ts](file://apps/backend/src/modules/users/users.controller.ts)

### Authentication Module
Responsibilities:
- Handle login and token issuance
- Provide tokens consumed by other controllers for authorization

```mermaid
classDiagram
class AuthController {
+login(credentials) Response
+verify(token) boolean
}
class AuthService {
-validateCredentials(credentials) boolean
-generateToken(user) string
-decodeToken(token) object
}
AuthController --> AuthService : "uses"
```

**Diagram sources**
- [apps/backend/src/modules/auth/auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [apps/backend/src/modules/auth/auth.service.ts](file://apps/backend/src/modules/auth/auth.service.ts)

**Section sources**
- [apps/backend/src/modules/auth/auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [apps/backend/src/modules/auth/auth.service.ts](file://apps/backend/src/modules/auth/auth.service.ts)

### Users Module
Responsibilities:
- Expose endpoints for user profile and subscription state
- Coordinate with business logic for subscription updates

```mermaid
classDiagram
class UsersController {
+getMe() Response
+updateSubscription(data) Response
}
class UsersService {
-getUserById(id) object
-setSubscription(userId, planId) void
-getSubscriptionHistory(userId) array
}
UsersController --> UsersService : "delegates"
```

**Diagram sources**
- [apps/backend/src/modules/users/users.controller.ts](file://apps/backend/src/modules/users/users.controller.ts)
- [apps/backend/src/modules/users/users.service.ts](file://apps/backend/src/modules/users/users.service.ts)

**Section sources**
- [apps/backend/src/modules/users/users.controller.ts](file://apps/backend/src/modules/users/users.controller.ts)
- [apps/backend/src/modules/users/users.service.ts](file://apps/backend/src/modules/users/users.service.ts)

### Roles Guard
Responsibilities:
- Enforce role-based access control on protected routes
- Allow/deny requests based on user roles

```mermaid
flowchart TD
Enter(["Incoming Request"]) --> ExtractRole["Extract Role from Token"]
ExtractRole --> CheckRole{"Has Required Role?"}
CheckRole --> |Yes| Allow["Proceed to Handler"]
CheckRole --> |No| Deny["Return 403 Forbidden"]
```

**Diagram sources**
- [apps/backend/src/common/guards/roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)

**Section sources**
- [apps/backend/src/common/guards/roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)

### HTTP Exception Filter
Responsibilities:
- Normalize error responses
- Log exceptions consistently

```mermaid
flowchart TD
Catch(["Exception Thrown"]) --> Format["Format Error Payload"]
Format --> Log["Log Details"]
Log --> Respond["Send Standardized Response"]
```

**Diagram sources**
- [apps/backend/src/common/filters/http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)

**Section sources**
- [apps/backend/src/common/filters/http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)

### App Bootstrap
Responsibilities:
- Initialize global guards and filters
- Configure middleware and CORS if needed

```mermaid
sequenceDiagram
participant Main as "main.ts"
participant Guard as "Roles Guard"
participant Filter as "HTTP Exception Filter"
Main->>Guard : "Register Global Guard"
Main->>Filter : "Register Global Filter"
Main-->>Main : "Start Server"
```

**Diagram sources**
- [apps/backend/src/main.ts](file://apps/backend/src/main.ts)
- [apps/backend/src/common/guards/roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [apps/backend/src/common/filters/http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)

**Section sources**
- [apps/backend/src/main.ts](file://apps/backend/src/main.ts)
- [apps/backend/src/common/guards/roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [apps/backend/src/common/filters/http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)

## Dependency Analysis
Relationships between components:
- Admin and Driver apps depend on Auth and Users modules
- Controllers rely on Services for business logic
- Guards and Filters are applied globally at the app bootstrap level

```mermaid
graph TB
Admin["Admin Subscriptions Page"] --> AuthCtrl["Auth Controller"]
Admin --> UsersCtrl["Users Controller"]
Driver["Driver Subscription Screen"] --> AuthCtrl
Driver --> UsersCtrl
AuthCtrl --> AuthSvc["Auth Service"]
UsersCtrl --> UsersSvc["Users Service"]
AuthCtrl --> RolesGuard["Roles Guard"]
UsersCtrl --> RolesGuard
AuthCtrl --> HttpFilter["HTTP Exception Filter"]
UsersCtrl --> HttpFilter
```

**Diagram sources**
- [apps/admin-web/src/app/dashboard/subscriptions/page.tsx](file://apps/admin-web/src/app/dashboard/subscriptions/page.tsx)
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/backend/src/modules/auth/auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [apps/backend/src/modules/auth/auth.service.ts](file://apps/backend/src/modules/auth/auth.service.ts)
- [apps/backend/src/modules/users/users.controller.ts](file://apps/backend/src/modules/users/users.controller.ts)
- [apps/backend/src/modules/users/users.service.ts](file://apps/backend/src/modules/users/users.service.ts)
- [apps/backend/src/common/guards/roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [apps/backend/src/common/filters/http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)

**Section sources**
- [apps/admin-web/src/app/dashboard/subscriptions/page.tsx](file://apps/admin-web/src/app/dashboard/subscriptions/page.tsx)
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/backend/src/modules/auth/auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [apps/backend/src/modules/auth/auth.service.ts](file://apps/backend/src/modules/auth/auth.service.ts)
- [apps/backend/src/modules/users/users.controller.ts](file://apps/backend/src/modules/users/users.controller.ts)
- [apps/backend/src/modules/users/users.service.ts](file://apps/backend/src/modules/users/users.service.ts)
- [apps/backend/src/common/guards/roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [apps/backend/src/common/filters/http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)

## Performance Considerations
- Cache frequently accessed subscription plans and analytics summaries at the service layer.
- Use pagination and filtering for large datasets in admin reports.
- Debounce client-side refreshes for subscription status to reduce redundant requests.
- Implement idempotent renewal endpoints to prevent duplicate charges.
- Add request timeouts and circuit breakers when integrating external payment providers.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Authentication failures: Verify token validity and expiration; ensure the auth controller is reachable.
- Authorization errors: Confirm the user has required roles; check the roles guard configuration.
- Unexpected server errors: Inspect standardized error payloads produced by the HTTP exception filter.
- Subscription state inconsistencies: Validate idempotency of renewal endpoints and reconcile state after payment callbacks.

Operational checks:
- Ensure global guards and filters are registered during app bootstrap.
- Validate CORS and headers for cross-origin admin and driver clients.

**Section sources**
- [apps/backend/src/modules/auth/auth.controller.ts](file://apps/backend/src/modules/auth/auth.controller.ts)
- [apps/backend/src/common/guards/roles.guard.ts](file://apps/backend/src/common/guards/roles.guard.ts)
- [apps/backend/src/common/filters/http-exception.filter.ts](file://apps/backend/src/common/filters/http-exception.filter.ts)
- [apps/backend/src/main.ts](file://apps/backend/src/main.ts)

## Conclusion
The subscription management system integrates admin and driver interfaces with a NestJS backend that provides authentication, user operations, role-based access control, and centralized error handling. While the current codebase exposes foundational pieces, extending it with dedicated subscription endpoints, payment integrations, and analytics will complete the feature set.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Conceptual: Payment Processing Integration
- Introduce a Payments Service to orchestrate provider SDKs (e.g., Stripe).
- Implement webhook handlers to reconcile payment events and update subscription states.
- Ensure idempotency keys to avoid duplicate charges.

[No sources needed since this section doesn't analyze specific files]

### Conceptual: Subscription Lifecycle Management
- States: active, pending, expired, canceled, refunded.
- Automated renewal: scheduled jobs trigger renewal attempts; handle failures with retries and notifications.
- Grace periods: allow limited usage after expiration before full suspension.

[No sources needed since this section doesn't analyze specific files]

### Conceptual: Subscription Tiers, Promotional Codes, Refunds
- Tiers: define pricing, limits, and features per tier.
- Promotions: apply discounts via promo codes with validation and expiration.
- Refunds: implement partial/full refunds with audit logs and compliance checks.

[No sources needed since this section doesn't analyze specific files]

### Conceptual: Reporting, Renewal Management, Customer Support Tools
- Reports: MRR, churn rate, cohort retention, top-performing tiers.
- Renewal management: retry policies, dunning emails, manual overrides.
- Support tools: search by user ID, view subscription history, issue credits/refunds.

[No sources needed since this section doesn't analyze specific files]