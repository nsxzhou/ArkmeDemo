# Hook Guidelines

> How hooks are used in ArkmeDemo.

## Overview

The project uses React built-in hooks directly. There is no React Query, SWR, Redux, Zustand, or router hook layer.

Custom hooks exist only when they represent shared app behavior. The main example is `usePreferences` from `src/settings/preferences.ts`.

## Custom Hook Patterns

- Name custom hooks with the `use*` prefix.
- Keep hook state close to its provider when it represents app-wide preferences.
- Keep page-specific state in the page component instead of extracting a hook prematurely.
- Guard browser-only APIs with `typeof window === "undefined"` checks when code can run during build.

Examples:

- `src/settings/preferences.ts` exposes `usePreferences` through `PreferencesProvider`.
- `src/layouts/AppShell.tsx` uses `useEffect` to update the phone status-bar time.
- `src/pages/Home.tsx` uses local helper functions plus React state for page-specific UI.

## Data Fetching

There is currently no server data fetching. Demo data is local, static, or stored in `localStorage`.

When adding browser storage reads:

- Wrap parsing in `try/catch`.
- Validate unknown values before converting them into typed app data.
- Return safe defaults when storage is missing or malformed.

## Naming Conventions

- Hook names must start with `use`.
- Initializer helpers use `getInitial*`, for example `getInitialTestMessages`.
- Persistence helpers use `persist*`, for example `persistTestMessages`.
- Normalizers use `normalize*`, for example `normalizeMessage`.

## Common Mistakes

- Reading `window` or `localStorage` without an environment guard.
- Extracting page-local state into a hook before there is real reuse.
- Forgetting to remove event listeners in `useEffect` cleanup.
