# Directory Structure

> How frontend code is organized in ArkmeDemo.

---

## Overview

This is a single Vite React app with route selection in `src/App.tsx`. It does not use a router library. The root path renders the mobile demo, while `/sendtest` renders the message test console.

---

## Directory Layout

```
src/
├── App.tsx
├── main.tsx
├── components/
├── data/
├── layouts/
├── lib/
├── pages/
├── settings/
├── styles/
└── types/
```

---

## Module Organization

- `src/pages/` holds page-level surfaces. Current examples are `Home.tsx`, `Records.tsx`, and `AdminMessageConsole.tsx`.
- `src/components/` holds reusable UI pieces such as `ChatBubble.tsx`, `ChatInput.tsx`, `ChatList.tsx`, `RecordDetailSheet.tsx`, and `RecordFullDetailScreen.tsx`.
- `src/layouts/` holds shell-level layout. `AppShell.tsx` owns the phone frame and status bar.
- `src/data/` holds local demo data, localStorage adapters, and UI data sources. `aiConversationLog.ts` is also part of the required Codex iteration record.
- `src/settings/` holds preferences and translations. `preferences.ts` owns theme, accent color, app icon, locale, and localized strings.
- `src/lib/` holds small shared utilities such as `time.ts` and `utils.ts`.
- `src/types/` holds shared domain types, for example `record.ts`.
- Static assets live under `public/`. Generated build output in `dist/` must not be edited.

New feature code should first fit one of these existing buckets. Add new top-level directories only when the feature cannot cleanly fit the current structure.

---

## Naming Conventions

- React component files use PascalCase: `ChatBubble.tsx`, `AppShell.tsx`.
- Page files use PascalCase under `src/pages/`.
- Utility files use lower camel case or short descriptive lowercase names: `time.ts`, `utils.ts`.
- Type names use PascalCase. Storage key constants use lower camel case and include the `arkme-demo.` prefix when stored in browser storage.

---

## Examples

- `src/App.tsx`: keeps the only route split between `/` and `/sendtest`.
- `src/layouts/AppShell.tsx`: wraps the mobile demo in the phone frame and status bar.
- `src/pages/AdminMessageConsole.tsx`: keeps the message test console isolated from the mobile demo route.
- `src/data/testConversations.ts`: centralizes message test storage keys, data constructors, and persistence helpers.
