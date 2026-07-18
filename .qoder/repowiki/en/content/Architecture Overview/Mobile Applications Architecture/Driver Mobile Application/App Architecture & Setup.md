# App Architecture & Setup

<cite>
**Referenced Files in This Document**
- [apps/mobile-driver/app.json](file://apps/mobile-driver/app.json)
- [apps/mobile-driver/metro.config.js](file://apps/mobile-driver/metro.config.js)
- [apps/mobile-driver/package.json](file://apps/mobile-driver/package.json)
- [apps/mobile-driver/tsconfig.json](file://apps/mobile-driver/tsconfig.json)
- [apps/mobile-driver/app/_layout.tsx](file://apps/mobile-driver/app/_layout.tsx)
- [apps/mobile-driver/app/index.tsx](file://apps/mobile-driver/app/index.tsx)
- [apps/mobile-driver/app/(auth)/_layout.tsx](file://apps/mobile-driver/app/(auth)/_layout.tsx)
- [apps/mobile-driver/app/(auth)/login.tsx](file://apps/mobile-driver/app/(auth)/login.tsx)
- [apps/mobile-driver/app/(auth)/verify-otp.tsx](file://apps/mobile-driver/app/(auth)/verify-otp.tsx)
- [apps/mobile-driver/app/(main)/_layout.tsx](file://apps/mobile-driver/app/(main)/_layout.tsx)
- [apps/mobile-driver/app/(main)/home.tsx](file://apps/mobile-driver/app/(main)/home.tsx)
- [apps/mobile-driver/app/(main)/earnings.tsx](file://apps/mobile-driver/app/(main)/earnings.tsx)
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/mobile-driver/app/(main)/profile.tsx](file://apps/mobile-driver/app/(main)/profile.tsx)
- [apps/mobile-driver/src/api/client.ts](file://apps/mobile-driver/src/api/client.ts)
- [apps/mobile-driver/src/api/socket.ts](file://apps/mobile-driver/src/api/socket.ts)
- [apps/mobile-driver/src/stores/auth-store.ts](file://apps/mobile-driver/src/stores/auth-store.ts)
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
This document explains the architecture and setup of the Driver Mobile Application built with React Native Expo. It covers the app directory structure, file-based routing, navigation layout configuration, initialization flow, core configuration files, authentication flow (login to OTP verification), JWT storage and session handling, platform-specific configurations for iOS and Android, build processes, and development environment setup.

## Project Structure
The Driver Mobile Application follows Expo Router’s app directory convention:
- Top-level entry point is at apps/mobile-driver/app/index.tsx.
- Layouts are defined via _layout.tsx files to compose nested navigators.
- Route groups (auth and main) separate unauthenticated and authenticated flows.
- Shared logic resides under src/, including API client, socket connection, and global state stores.

```mermaid
graph TB
A["apps/mobile-driver"] --> B["app/"]
A --> C["src/"]
A --> D["assets/"]
A --> E["app.json"]
A --> F["metro.config.js"]
A --> G["package.json"]
A --> H["tsconfig.json"]
B --> B1["_layout.tsx"]
B --> B2["index.tsx"]
B --> B3["(auth)/"]
B --> B4["(main)/"]
B3 --> B3a["_layout.tsx"]
B3 --> B3b["login.tsx"]
B3 --> B3c["verify-otp.tsx"]
B4 --> B4a["_layout.tsx"]
B4 --> B4b["home.tsx"]
B4 --> B4c["earnings.tsx"]
B4 --> B4d["subscription.tsx"]
B4 --> B4e["profile.tsx"]
C --> C1["api/client.ts"]
C --> C2["api/socket.ts"]
C --> C3["stores/auth-store.ts"]
```

**Diagram sources**
- [apps/mobile-driver/app/_layout.tsx](file://apps/mobile-driver/app/_layout.tsx)
- [apps/mobile-driver/app/index.tsx](file://apps/mobile-driver/app/index.tsx)
- [apps/mobile-driver/app/(auth)/_layout.tsx](file://apps/mobile-driver/app/(auth)/_layout.tsx)
- [apps/mobile-driver/app/(auth)/login.tsx](file://apps/mobile-driver/app/(auth)/login.tsx)
- [apps/mobile-driver/app/(auth)/verify-otp.tsx](file://apps/mobile-driver/app/(auth)/verify-otp.tsx)
- [apps/mobile-driver/app/(main)/_layout.tsx](file://apps/mobile-driver/app/(main)/_layout.tsx)
- [apps/mobile-driver/app/(main)/home.tsx](file://apps/mobile-driver/app/(main)/home.tsx)
- [apps/mobile-driver/app/(main)/earnings.tsx](file://apps/mobile-driver/app/(main)/earnings.tsx)
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/mobile-driver/app/(main)/profile.tsx](file://apps/mobile-driver/app/(main)/profile.tsx)
- [apps/mobile-driver/src/api/client.ts](file://apps/mobile-driver/src/api/client.ts)
- [apps/mobile-driver/src/api/socket.ts](file://apps/mobile-driver/src/api/socket.ts)
- [apps/mobile-driver/src/stores/auth-store.ts](file://apps/mobile-driver/src/stores/auth-store.ts)
- [apps/mobile-driver/app.json](file://apps/mobile-driver/app.json)
- [apps/mobile-driver/metro.config.js](file://apps/mobile-driver/metro.config.js)
- [apps/mobile-driver/package.json](file://apps/mobile-driver/package.json)
- [apps/mobile-driver/tsconfig.json](file://apps/mobile-driver/tsconfig.json)

**Section sources**
- [apps/mobile-driver/app.json](file://apps/mobile-driver/app.json)
- [apps/mobile-driver/metro.config.js](file://apps/mobile-driver/metro.config.js)
- [apps/mobile-driver/package.json](file://apps/mobile-driver/package.json)
- [apps/mobile-driver/tsconfig.json](file://apps/mobile-driver/tsconfig.json)
- [apps/mobile-driver/app/_layout.tsx](file://apps/mobile-driver/app/_layout.tsx)
- [apps/mobile-driver/app/index.tsx](file://apps/mobile-driver/app/index.tsx)
- [apps/mobile-driver/app/(auth)/_layout.tsx](file://apps/mobile-driver/app/(auth)/_layout.tsx)
- [apps/mobile-driver/app/(auth)/login.tsx](file://apps/mobile-driver/app/(auth)/login.tsx)
- [apps/mobile-driver/app/(auth)/verify-otp.tsx](file://apps/mobile-driver/app/(auth)/verify-otp.tsx)
- [apps/mobile-driver/app/(main)/_layout.tsx](file://apps/mobile-driver/app/(main)/_layout.tsx)
- [apps/mobile-driver/app/(main)/home.tsx](file://apps/mobile-driver/app/(main)/home.tsx)
- [apps/mobile-driver/app/(main)/earnings.tsx](file://apps/mobile-driver/app/(main)/earnings.tsx)
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/mobile-driver/app/(main)/profile.tsx](file://apps/mobile-driver/app/(main)/profile.tsx)
- [apps/mobile-driver/src/api/client.ts](file://apps/mobile-driver/src/api/client.ts)
- [apps/mobile-driver/src/api/socket.ts](file://apps/mobile-driver/src/api/socket.ts)
- [apps/mobile-driver/src/stores/auth-store.ts](file://apps/mobile-driver/src/stores/auth-store.ts)

## Core Components
- Entry point and root layout
  - The application bootstraps from the index route and composes a root layout that renders the top-level navigator and providers.
  - The root layout typically initializes global providers and sets up the initial navigation shell.
- Authentication routes
  - Grouped under (auth) to enforce unauthenticated-only access.
  - login.tsx handles credential submission and triggers OTP generation.
  - verify-otp.tsx validates the OTP and completes sign-in.
- Main routes
  - Grouped under (main) to enforce authenticated-only access.
  - home.tsx serves as the primary dashboard; earnings.tsx, subscription.tsx, and profile.tsx provide driver-specific features.
- State management
  - auth-store.ts centralizes authentication state, token persistence, and session lifecycle.
- Networking
  - api/client.ts configures HTTP requests, headers, and interceptors for token injection and error handling.
  - api/socket.ts manages real-time connections used for live updates.

**Section sources**
- [apps/mobile-driver/app/index.tsx](file://apps/mobile-driver/app/index.tsx)
- [apps/mobile-driver/app/_layout.tsx](file://apps/mobile-driver/app/_layout.tsx)
- [apps/mobile-driver/app/(auth)/_layout.tsx](file://apps/mobile-driver/app/(auth)/_layout.tsx)
- [apps/mobile-driver/app/(auth)/login.tsx](file://apps/mobile-driver/app/(auth)/login.tsx)
- [apps/mobile-driver/app/(auth)/verify-otp.tsx](file://apps/mobile-driver/app/(auth)/verify-otp.tsx)
- [apps/mobile-driver/app/(main)/_layout.tsx](file://apps/mobile-driver/app/(main)/_layout.tsx)
- [apps/mobile-driver/app/(main)/home.tsx](file://apps/mobile-driver/app/(main)/home.tsx)
- [apps/mobile-driver/app/(main)/earnings.tsx](file://apps/mobile-driver/app/(main)/earnings.tsx)
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/mobile-driver/app/(main)/profile.tsx](file://apps/mobile-driver/app/(main)/profile.tsx)
- [apps/mobile-driver/src/stores/auth-store.ts](file://apps/mobile-driver/src/stores/auth-store.ts)
- [apps/mobile-driver/src/api/client.ts](file://apps/mobile-driver/src/api/client.ts)
- [apps/mobile-driver/src/api/socket.ts](file://apps/mobile-driver/src/api/socket.ts)

## Architecture Overview
The app uses Expo Router with file-based routing and route groups to separate authentication and authenticated experiences. The root layout wires together navigation and global providers. Authenticated screens depend on the auth store for tokens and user context, while networking utilities attach tokens to outgoing requests.

```mermaid
graph TB
subgraph "App Shell"
RootLayout["Root Layout<br/>app/_layout.tsx"]
IndexRoute["Index Route<br/>app/index.tsx"]
end
subgraph "Auth Flow"
AuthLayout["Auth Layout<br/>app/(auth)/_layout.tsx"]
Login["Login Screen<br/>app/(auth)/login.tsx"]
VerifyOTP["Verify OTP Screen<br/>app/(auth)/verify-otp.tsx"]
end
subgraph "Main Flow"
MainLayout["Main Layout<br/>app/(main)/_layout.tsx"]
Home["Home Screen<br/>app/(main)/home.tsx"]
Earnings["Earnings Screen<br/>app/(main)/earnings.tsx"]
Subscription["Subscription Screen<br/>app/(main)/subscription.tsx"]
Profile["Profile Screen<br/>app/(main)/profile.tsx"]
end
subgraph "State & Network"
AuthStore["Auth Store<br/>src/stores/auth-store.ts"]
APIClient["HTTP Client<br/>src/api/client.ts"]
SocketConn["Socket Connection<br/>src/api/socket.ts"]
end
RootLayout --> IndexRoute
RootLayout --> AuthLayout
RootLayout --> MainLayout
AuthLayout --> Login
AuthLayout --> VerifyOTP
MainLayout --> Home
MainLayout --> Earnings
MainLayout --> Subscription
MainLayout --> Profile
Login --> AuthStore
VerifyOTP --> AuthStore
Home --> AuthStore
Earnings --> AuthStore
Subscription --> AuthStore
Profile --> AuthStore
AuthStore --> APIClient
AuthStore --> SocketConn
```

**Diagram sources**
- [apps/mobile-driver/app/_layout.tsx](file://apps/mobile-driver/app/_layout.tsx)
- [apps/mobile-driver/app/index.tsx](file://apps/mobile-driver/app/index.tsx)
- [apps/mobile-driver/app/(auth)/_layout.tsx](file://apps/mobile-driver/app/(auth)/_layout.tsx)
- [apps/mobile-driver/app/(auth)/login.tsx](file://apps/mobile-driver/app/(auth)/login.tsx)
- [apps/mobile-driver/app/(auth)/verify-otp.tsx](file://apps/mobile-driver/app/(auth)/verify-otp.tsx)
- [apps/mobile-driver/app/(main)/_layout.tsx](file://apps/mobile-driver/app/(main)/_layout.tsx)
- [apps/mobile-driver/app/(main)/home.tsx](file://apps/mobile-driver/app/(main)/home.tsx)
- [apps/mobile-driver/app/(main)/earnings.tsx](file://apps/mobile-driver/app/(main)/earnings.tsx)
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/mobile-driver/app/(main)/profile.tsx](file://apps/mobile-driver/app/(main)/profile.tsx)
- [apps/mobile-driver/src/stores/auth-store.ts](file://apps/mobile-driver/src/stores/auth-store.ts)
- [apps/mobile-driver/src/api/client.ts](file://apps/mobile-driver/src/api/client.ts)
- [apps/mobile-driver/src/api/socket.ts](file://apps/mobile-driver/src/api/socket.ts)

## Detailed Component Analysis

### App Initialization and Entry Points
- Entry point
  - The index route acts as the first screen and typically redirects based on authentication state.
- Root layout
  - Composes the navigation container and any global providers required by the app.
- Platform configuration
  - app.json defines app metadata, bundle identifiers, and platform-specific settings.
- Metro bundler
  - metro.config.js customizes module resolution and asset handling for the project.

```mermaid
flowchart TD
Start(["App Launch"]) --> LoadConfig["Load app.json and metro.config.js"]
LoadConfig --> BootRoot["Boot Root Layout"]
BootRoot --> CheckAuth["Check Auth State"]
CheckAuth --> |Not Authenticated| GoAuth["Navigate to Auth Group"]
CheckAuth --> |Authenticated| GoMain["Navigate to Main Group"]
GoAuth --> End(["Ready"])
GoMain --> End
```

**Diagram sources**
- [apps/mobile-driver/app.json](file://apps/mobile-driver/app.json)
- [apps/mobile-driver/metro.config.js](file://apps/mobile-driver/metro.config.js)
- [apps/mobile-driver/app/_layout.tsx](file://apps/mobile-driver/app/_layout.tsx)
- [apps/mobile-driver/app/index.tsx](file://apps/mobile-driver/app/index.tsx)

**Section sources**
- [apps/mobile-driver/app.json](file://apps/mobile-driver/app.json)
- [apps/mobile-driver/metro.config.js](file://apps/mobile-driver/metro.config.js)
- [apps/mobile-driver/app/_layout.tsx](file://apps/mobile-driver/app/_layout.tsx)
- [apps/mobile-driver/app/index.tsx](file://apps/mobile-driver/app/index.tsx)

### File-Based Routing and Navigation Layouts
- Route groups
  - (auth): Enforces unauthenticated-only access. Contains login and verify-otp screens.
  - (main): Enforces authenticated-only access. Contains home, earnings, subscription, and profile screens.
- Layouts
  - Each group has a _layout.tsx that composes its own navigator and guards.
  - The root _layout.tsx provides the top-level navigation shell.

```mermaid
sequenceDiagram
participant User as "User"
participant Router as "Expo Router"
participant AuthLayout as "Auth Layout"
participant MainLayout as "Main Layout"
participant Login as "login.tsx"
participant VerifyOTP as "verify-otp.tsx"
participant Home as "home.tsx"
User->>Router : Open app
Router->>AuthLayout : Render if not authenticated
AuthLayout->>Login : Show login form
User->>Login : Submit credentials
Login-->>AuthLayout : Request OTP
AuthLayout->>VerifyOTP : Navigate to verify-otp
User->>VerifyOTP : Enter OTP
VerifyOTP-->>AuthLayout : Complete sign-in
AuthLayout->>MainLayout : Redirect to main group
MainLayout->>Home : Show dashboard
```

**Diagram sources**
- [apps/mobile-driver/app/(auth)/_layout.tsx](file://apps/mobile-driver/app/(auth)/_layout.tsx)
- [apps/mobile-driver/app/(auth)/login.tsx](file://apps/mobile-driver/app/(auth)/login.tsx)
- [apps/mobile-driver/app/(auth)/verify-otp.tsx](file://apps/mobile-driver/app/(auth)/verify-otp.tsx)
- [apps/mobile-driver/app/(main)/_layout.tsx](file://apps/mobile-driver/app/(main)/_layout.tsx)
- [apps/mobile-driver/app/(main)/home.tsx](file://apps/mobile-driver/app/(main)/home.tsx)

**Section sources**
- [apps/mobile-driver/app/(auth)/_layout.tsx](file://apps/mobile-driver/app/(auth)/_layout.tsx)
- [apps/mobile-driver/app/(auth)/login.tsx](file://apps/mobile-driver/app/(auth)/login.tsx)
- [apps/mobile-driver/app/(auth)/verify-otp.tsx](file://apps/mobile-driver/app/(auth)/verify-otp.tsx)
- [apps/mobile-driver/app/(main)/_layout.tsx](file://apps/mobile-driver/app/(main)/_layout.tsx)
- [apps/mobile-driver/app/(main)/home.tsx](file://apps/mobile-driver/app/(main)/home.tsx)
- [apps/mobile-driver/app/(main)/earnings.tsx](file://apps/mobile-driver/app/(main)/earnings.tsx)
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/mobile-driver/app/(main)/profile.tsx](file://apps/mobile-driver/app/(main)/profile.tsx)

### Authentication Flow: Login to OTP Verification
- Steps
  - User submits phone/email or other identifier on login.
  - Server sends OTP; app navigates to verify-otp.
  - On successful verification, app persists tokens and transitions to main routes.
- Token storage and session handling
  - Tokens are stored securely via the auth store.
  - Session is validated on app start and before network calls.

```mermaid
sequenceDiagram
participant UI as "UI Screens"
participant Store as "Auth Store"
participant API as "HTTP Client"
participant Net as "Network"
UI->>API : POST /auth/login
API->>Net : Send request
Net-->>API : { requiresOTP : true }
API-->>UI : Prompt for OTP
UI->>API : POST /auth/verify-otp
API->>Net : Send request
Net-->>API : { accessToken, refreshToken }
API-->>Store : Persist tokens
Store-->>UI : Update auth state
UI->>UI : Navigate to main group
```

**Diagram sources**
- [apps/mobile-driver/src/stores/auth-store.ts](file://apps/mobile-driver/src/stores/auth-store.ts)
- [apps/mobile-driver/src/api/client.ts](file://apps/mobile-driver/src/api/client.ts)
- [apps/mobile-driver/app/(auth)/login.tsx](file://apps/mobile-driver/app/(auth)/login.tsx)
- [apps/mobile-driver/app/(auth)/verify-otp.tsx](file://apps/mobile-driver/app/(auth)/verify-otp.tsx)

**Section sources**
- [apps/mobile-driver/src/stores/auth-store.ts](file://apps/mobile-driver/src/stores/auth-store.ts)
- [apps/mobile-driver/src/api/client.ts](file://apps/mobile-driver/src/api/client.ts)
- [apps/mobile-driver/app/(auth)/login.tsx](file://apps/mobile-driver/app/(auth)/login.tsx)
- [apps/mobile-driver/app/(auth)/verify-otp.tsx](file://apps/mobile-driver/app/(auth)/verify-otp.tsx)

### JWT Storage and Management
- Responsibilities
  - Securely persist tokens on device.
  - Attach tokens to outgoing requests via the HTTP client.
  - Refresh tokens when expired and handle re-authentication flows.
- Integration points
  - Auth store exposes getters/setters for tokens.
  - HTTP client reads tokens from the store and injects them into headers.

```mermaid
classDiagram
class AuthStore {
+getAccessToken() string?
+setTokens(access, refresh) void
+clearTokens() void
+isAuthenticated() bool
}
class APIClient {
+request(url, options) Promise
-attachToken(headers) Headers
}
AuthStore <.. APIClient : "reads/writes tokens"
```

**Diagram sources**
- [apps/mobile-driver/src/stores/auth-store.ts](file://apps/mobile-driver/src/stores/auth-store.ts)
- [apps/mobile-driver/src/api/client.ts](file://apps/mobile-driver/src/api/client.ts)

**Section sources**
- [apps/mobile-driver/src/stores/auth-store.ts](file://apps/mobile-driver/src/stores/auth-store.ts)
- [apps/mobile-driver/src/api/client.ts](file://apps/mobile-driver/src/api/client.ts)

### Real-Time Communication
- Purpose
  - Maintain a persistent socket connection for live updates (e.g., ride status).
- Lifecycle
  - Connect after authentication; reconnect on errors; close on logout.

```mermaid
flowchart TD
Start(["App Ready"]) --> CheckAuth{"Authenticated?"}
CheckAuth --> |No| Idle["Idle"]
CheckAuth --> |Yes| Connect["Connect Socket"]
Connect --> Events["Listen for Events"]
Events --> Reconnect{"Connection Lost?"}
Reconnect --> |Yes| Connect
Reconnect --> |No| Events
Idle --> End(["End"])
Events --> End
```

**Diagram sources**
- [apps/mobile-driver/src/api/socket.ts](file://apps/mobile-driver/src/api/socket.ts)
- [apps/mobile-driver/src/stores/auth-store.ts](file://apps/mobile-driver/src/stores/auth-store.ts)

**Section sources**
- [apps/mobile-driver/src/api/socket.ts](file://apps/mobile-driver/src/api/socket.ts)
- [apps/mobile-driver/src/stores/auth-store.ts](file://apps/mobile-driver/src/stores/auth-store.ts)

### Platform-Specific Configuration and Build Processes
- app.json
  - Defines app name, slug, version, icon, splash, and platform-specific keys for iOS and Android.
- metro.config.js
  - Configures Metro bundler behavior such as module resolution and asset handling.
- package.json
  - Declares dependencies and scripts for running, building, and ejecting.
- tsconfig.json
  - Sets TypeScript compiler options and path mappings for the app.

```mermaid
graph TB
Pkg["package.json"] --> Scripts["Scripts: dev/build/test"]
JSON["app.json"] --> Meta["App Metadata & Platform Keys"]
Metro["metro.config.js"] --> Bundler["Bundler Config"]
TS["tsconfig.json"] --> Types["TypeScript Options"]
```

**Diagram sources**
- [apps/mobile-driver/package.json](file://apps/mobile-driver/package.json)
- [apps/mobile-driver/app.json](file://apps/mobile-driver/app.json)
- [apps/mobile-driver/metro.config.js](file://apps/mobile-driver/metro.config.js)
- [apps/mobile-driver/tsconfig.json](file://apps/mobile-driver/tsconfig.json)

**Section sources**
- [apps/mobile-driver/package.json](file://apps/mobile-driver/package.json)
- [apps/mobile-driver/app.json](file://apps/mobile-driver/app.json)
- [apps/mobile-driver/metro.config.js](file://apps/mobile-driver/metro.config.js)
- [apps/mobile-driver/tsconfig.json](file://apps/mobile-driver/tsconfig.json)

## Dependency Analysis
High-level dependency relationships between core modules:

```mermaid
graph LR
AuthStore["auth-store.ts"] --> APIClient["api/client.ts"]
AuthStore --> SocketConn["api/socket.ts"]
Login["(auth)/login.tsx"] --> AuthStore
VerifyOTP["(auth)/verify-otp.tsx"] --> AuthStore
Home["(main)/home.tsx"] --> AuthStore
Earnings["(main)/earnings.tsx"] --> AuthStore
Subscription["(main)/subscription.tsx"] --> AuthStore
Profile["(main)/profile.tsx"] --> AuthStore
RootLayout["app/_layout.tsx"] --> AuthStore
IndexRoute["app/index.tsx"] --> AuthStore
```

**Diagram sources**
- [apps/mobile-driver/src/stores/auth-store.ts](file://apps/mobile-driver/src/stores/auth-store.ts)
- [apps/mobile-driver/src/api/client.ts](file://apps/mobile-driver/src/api/client.ts)
- [apps/mobile-driver/src/api/socket.ts](file://apps/mobile-driver/src/api/socket.ts)
- [apps/mobile-driver/app/(auth)/login.tsx](file://apps/mobile-driver/app/(auth)/login.tsx)
- [apps/mobile-driver/app/(auth)/verify-otp.tsx](file://apps/mobile-driver/app/(auth)/verify-otp.tsx)
- [apps/mobile-driver/app/(main)/home.tsx](file://apps/mobile-driver/app/(main)/home.tsx)
- [apps/mobile-driver/app/(main)/earnings.tsx](file://apps/mobile-driver/app/(main)/earnings.tsx)
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/mobile-driver/app/(main)/profile.tsx](file://apps/mobile-driver/app/(main)/profile.tsx)
- [apps/mobile-driver/app/_layout.tsx](file://apps/mobile-driver/app/_layout.tsx)
- [apps/mobile-driver/app/index.tsx](file://apps/mobile-driver/app/index.tsx)

**Section sources**
- [apps/mobile-driver/src/stores/auth-store.ts](file://apps/mobile-driver/src/stores/auth-store.ts)
- [apps/mobile-driver/src/api/client.ts](file://apps/mobile-driver/src/api/client.ts)
- [apps/mobile-driver/src/api/socket.ts](file://apps/mobile-driver/src/api/socket.ts)
- [apps/mobile-driver/app/(auth)/login.tsx](file://apps/mobile-driver/app/(auth)/login.tsx)
- [apps/mobile-driver/app/(auth)/verify-otp.tsx](file://apps/mobile-driver/app/(auth)/verify-otp.tsx)
- [apps/mobile-driver/app/(main)/home.tsx](file://apps/mobile-driver/app/(main)/home.tsx)
- [apps/mobile-driver/app/(main)/earnings.tsx](file://apps/mobile-driver/app/(main)/earnings.tsx)
- [apps/mobile-driver/app/(main)/subscription.tsx](file://apps/mobile-driver/app/(main)/subscription.tsx)
- [apps/mobile-driver/app/(main)/profile.tsx](file://apps/mobile-driver/app/(main)/profile.tsx)
- [apps/mobile-driver/app/_layout.tsx](file://apps/mobile-driver/app/_layout.tsx)
- [apps/mobile-driver/app/index.tsx](file://apps/mobile-driver/app/index.tsx)

## Performance Considerations
- Minimize re-renders by keeping auth state lightweight and memoizing derived values.
- Defer heavy computations off the UI thread where possible.
- Use efficient list rendering and pagination for data-heavy screens.
- Cache API responses appropriately and invalidate on relevant events.
- Keep socket listeners scoped to specific screens and clean up on unmount.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Authentication issues
  - Ensure tokens are persisted correctly and attached to requests.
  - Validate OTP endpoints and error messages for clear feedback.
- Navigation problems
  - Confirm route groups are configured and layouts render their children.
  - Check redirect logic in the index route based on auth state.
- Networking and sockets
  - Inspect headers for missing or expired tokens.
  - Handle reconnection logic and backoff strategies for socket failures.
- Build and bundling
  - Verify app.json platform keys and bundle identifiers.
  - Review metro.config.js for incorrect module paths or asset rules.

**Section sources**
- [apps/mobile-driver/src/stores/auth-store.ts](file://apps/mobile-driver/src/stores/auth-store.ts)
- [apps/mobile-driver/src/api/client.ts](file://apps/mobile-driver/src/api/client.ts)
- [apps/mobile-driver/src/api/socket.ts](file://apps/mobile-driver/src/api/socket.ts)
- [apps/mobile-driver/app/index.tsx](file://apps/mobile-driver/app/index.tsx)
- [apps/mobile-driver/app/(auth)/login.tsx](file://apps/mobile-driver/app/(auth)/login.tsx)
- [apps/mobile-driver/app/(auth)/verify-otp.tsx](file://apps/mobile-driver/app/(auth)/verify-otp.tsx)
- [apps/mobile-driver/app/(main)/_layout.tsx](file://apps/mobile-driver/app/(main)/_layout.tsx)
- [apps/mobile-driver/app.json](file://apps/mobile-driver/app.json)
- [apps/mobile-driver/metro.config.js](file://apps/mobile-driver/metro.config.js)

## Conclusion
The Driver Mobile Application leverages Expo Router’s file-based routing and route groups to cleanly separate authentication and authenticated experiences. The root layout orchestrates navigation and providers, while the auth store centralizes token management and session handling. Networking utilities integrate with the store to ensure secure requests and reliable real-time communication. Platform-specific configurations and build scripts enable consistent development and deployment across iOS and Android.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Development Environment Setup
- Install dependencies using the project’s package manager.
- Run the development server and launch on connected devices or emulators.
- Configure platform-specific keys in app.json for iOS and Android builds.
- Adjust metro.config.js if adding custom module resolution or assets.

**Section sources**
- [apps/mobile-driver/package.json](file://apps/mobile-driver/package.json)
- [apps/mobile-driver/app.json](file://apps/mobile-driver/app.json)
- [apps/mobile-driver/metro.config.js](file://apps/mobile-driver/metro.config.js)