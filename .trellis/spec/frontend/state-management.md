# State Management

> How state is managed in ArkmeDemo.

## Overview

State is managed with React state, context, memoized derived values, and browser `localStorage`. There is no external state management library.

## State Categories

- App-level page selection lives in `src/App.tsx` as `currentPage`.
- Preferences live in `PreferencesProvider` from `src/settings/preferences.ts`.
- Mobile demo UI state lives mainly in `src/pages/Home.tsx`.
- Message test console state lives in `src/pages/AdminMessageConsole.tsx`.
- Durable demo data uses `localStorage` through helpers in `src/data/testConversations.ts` and page-local persistence helpers.
- Route state is minimal and path-based: `/sendtest` switches to the message test console; all other paths render the mobile demo.

## When to Use Global State

Use React context only when multiple distant components need the same state. Current global preference state includes theme, accent color, app icon, and locale.

Keep feature-specific state local unless at least two independent surfaces need to read and write it.

## Server State

There is no server state in the current demo. The interview upload script is a Node script under `scripts/`, not frontend server state.

## Arrangement Recognition State

- AI recognition state is local-only and stored under explicit `arkme-demo.*` keys.
- Send-to-self recognition uses `arkme-demo.arrangementRecognition.self` and deduplicates by `recordUid`.
- Private-chat recognition uses `arkme-demo.arrangementRecognition.private` and deduplicates by `conversationId + replyMessageId`.
- Group-chat recognition uses `arkme-demo.arrangementRecognition.group` and deduplicates by `conversationId + replyMessageId`.
- New arrangement recognition modules must expose `getInitial*States`, `persist*States`, `create*RecognitionState`, and `recognize*Arrangement` helpers so `Home.tsx` can keep UI state, retry behavior, and storage normalization consistent.

## Common Mistakes

- Treating `localStorage` data as trusted. Always normalize unknown values.
- Introducing global state for a single page interaction.
- Forgetting to dispatch or listen for `arkme-demo:test-conversations-updated` when test conversation data changes in the same tab.
- Adding a new arrangement recognition localStorage key without a normalizer and a persistable-state mapper.
