---
kind: logging_system
name: NestJS Built-in Logger with HTTP Interceptor and Exception Filter
category: logging_system
scope:
    - '**'
source_files:
    - apps/backend/src/main.ts
    - apps/backend/src/common/interceptors/logging.interceptor.ts
    - apps/backend/src/common/filters/http-exception.filter.ts
---

The KansRide backend uses NestJS's built-in `@nestjs/common` `Logger` class for all logging. There is no third-party logging framework (winston, pino, bunyan) — the entire system relies on NestJS's default console-based logger.

**Framework and initialization**
- The bootstrap in `apps/backend/src/main.ts` creates a top-level `Logger('Bootstrap')` instance to log startup messages.
- No global logger configuration or custom transport is set up; logs go straight to stdout via `console.log`/`console.error` behind the scenes.

**Cross-cutting logging points**
- **HTTP request timing**: `LoggingInterceptor` (`apps/backend/src/common/interceptors/logging.interceptor.ts`) wraps every controller request and logs `method url - elapsedms` using a `Logger('HTTP')` instance.
- **Global exception handling**: `AllExceptionsFilter` (`apps/backend/src/common/filters/http-exception.filter.ts`) catches all exceptions, logs `status - message` plus stack traces via `logger.error`, and returns a uniform JSON error response.
- **Module services**: Every service instantiates its own `Logger(ServiceName)` (e.g., `AuthService.name`, `DriversService.name`, `RidesService.name`, `EventsGateway.name`) and calls `this.logger.log(...)`, `this.logger.debug(...)`, `this.logger.error(...)` at key business events (OTP generation, driver registration, ride requests, WebSocket connect/disconnect).

**Log levels used**
- `log()` — normal operational events (request timing, connection events, business actions).
- `error()` — caught exceptions with full stack traces.
- `debug()` — low-frequency diagnostic traces (driver location updates).
- `warn()` is not used anywhere in the codebase.

**Structured fields**
- Logging is unstructured string interpolation only (e.g., `${method} ${url} - ${elapsed}ms`). No consistent structured payload (JSON objects with named fields like `userId`, `rideId`, `sessionId`) is emitted by the logger itself. The exception filter does include `timestamp` in the HTTP response body but not as part of the log line.

**Frontend / mobile apps**
- No dedicated logging library is imported in the frontend or mobile apps; they rely on the browser/device console implicitly.

**Conventions developers should follow**
- Instantiate a module-scoped logger via `private readonly logger = new Logger(YourClass.name);` so the class name appears as the logger context prefix.
- Use `logger.log()` for routine events, `logger.error()` for errors (passing an `Error` object as the second argument to capture the stack), and `logger.debug()` sparingly for diagnostics.
- Avoid raw `console.*` calls — none were found in the codebase, which is good practice.
- Do not expect structured log output from the current setup; if structured logs are needed, a transport or wrapper would have to be added around the NestJS `Logger`.