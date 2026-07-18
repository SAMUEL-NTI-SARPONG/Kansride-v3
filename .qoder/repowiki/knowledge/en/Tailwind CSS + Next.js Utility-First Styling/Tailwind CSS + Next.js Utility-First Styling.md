---
kind: frontend_style
name: Tailwind CSS + Next.js Utility-First Styling
category: frontend_style
scope:
    - '**'
source_files:
    - apps/admin-web/tailwind.config.js
    - apps/tracking-web/tailwind.config.js
    - apps/admin-web/src/app/globals.css
    - apps/tracking-web/src/app/globals.css
    - apps/admin-web/package.json
    - apps/tracking-web/package.json
---

The KansRide monorepo uses a utility-first styling approach centered on **Tailwind CSS** across its web applications, with React Native StyleSheet for mobile apps. There is no shared design-system package yet (the `packages/design-system` directory exists but is empty), so each app maintains its own Tailwind configuration.

### Web apps (Next.js)
- Both `apps/admin-web` and `apps/tracking-web` are Next.js 15 apps with Tailwind CSS 3.4, PostCSS 8, and Autoprefixer as dev dependencies.
- Global styles are declared in `src/app/globals.css` via the standard `@tailwind base; @tailwind components; @tailwind utilities;` directives.
- Each app has its own `tailwind.config.js` extending the default theme with brand colors:
  - `primary`: `#1B8B4B` (green) with `light: #2EAF65`, `dark: #146B39`
  - `secondary`: `#FFB800` (amber) with `light: #FFCC40`, `dark: #CC9300` (admin only)
- Components use inline Tailwind class names directly in JSX (`className="text-2xl font-bold text-gray-900 mb-6"`, `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`, etc.).
- The admin app sets a system font stack in `globals.css`; the tracking app relies on Tailwind's defaults.
- No custom plugins or third-party UI libraries are configured in either Tailwind config.

### Mobile apps (React Native / Expo)
- `apps/mobile-driver` and `apps/mobile-passenger` are Expo Router apps built on React Native 0.76.
- They declare a dependency on `@kansride/ui` (a workspace package that does not exist yet), suggesting an intended shared component library, but at present there is no implementation under `packages/design-system`.
- Styling is therefore done via inline React Native `style` objects using the platform's native StyleSheet API — no CSS-in-JS or styled-components usage was found.

### Conventions to follow
- Prefer Tailwind utility classes over custom CSS; keep global CSS minimal (only `@tailwind` directives and essential resets).
- Use the `primary`/`secondary` color tokens from `tailwind.config.js` instead of hard-coded hex values.
- When the shared `@kansride/ui` package is implemented, migrate reusable components out of apps into it and consume them consistently across all frontends.
- Keep responsive breakpoints consistent by relying on Tailwind's default breakpoint scale (`md:`, `lg:`) rather than introducing custom ones per app.