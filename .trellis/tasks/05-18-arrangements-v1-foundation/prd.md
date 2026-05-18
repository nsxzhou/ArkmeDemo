# Arrangements V1 Foundation

## Goal

Build the V1 "安排" foundation in the mobile demo: a first-level bottom navigation entry with a warm, low-anxiety arrangement list, manual creation, detail view, completion, later/settled handling, and local persistence.

## What I Already Know

- The repository is a React/Vite/TypeScript mobile-first demo.
- The mobile demo route is `http://127.0.0.1:5173/`; `/sendtest` is a separate message test console and is not part of V1.
- Current page selection lives in `src/App.tsx` as `PageType`.
- Main mobile UI state and bottom navigation are in `src/pages/Home.tsx`.
- Existing durable demo data uses normalized `localStorage` helpers with `arkme-demo.*` keys.
- Project answer rules require the candidate Markdown log and `src/data/aiConversationLog.ts` to stay synchronized.
- The planning conversation locked V1 scope: no real AI, no backend, no notification trigger, no calendar, no private/group chat recognition.

## Requirements

- Add `"arrangements"` to `PageType` and show bottom navigation as `快记 / 安排 / 洞见 / 我的`.
- Add an arrangements page using the existing mobile visual language: gray surfaces, green accent, compact mobile density, gentle status copy, no strong red overdue styling.
- Show small default demo arrangements on first load, with an action to clear demo items.
- Persist user-created and modified arrangements in `localStorage` under `arkme-demo.arrangements`.
- Group arrangements into Today, Upcoming, Later, No time, and Later/Silenced sections.
- Manual creation uses a bottom sheet with fields for title, description, time text/date time, location, participants, and reminder display text.
- Detail view shows title, status, time, location, participants, reminders, source/context, and actions.
- Support create, edit, complete, later, restore to pending, delete/archive.
- Reminder fields are saved and displayed only; they do not trigger browser/system notifications.
- Use explicit TypeScript types for the arrangement domain and normalize parsed storage data.
- Add Chinese, Traditional Chinese, and English translation keys for new user-facing text.

## Acceptance Criteria

- [x] Bottom navigation includes "安排" and opens the arrangements page.
- [x] First open shows demo arrangements; clearing demo items leaves an empty state and create action.
- [x] Creating "后天去医院" persists after refresh.
- [x] Detail view supports editing, completion, later, restore, and delete/archive.
- [x] Overdue pending items are shown gently, without danger/red failure styling.
- [x] Light/dark theme and locale switching keep text readable and non-overlapping.
- [x] `pnpm verify:answer` passes.

## Out Of Scope

- OpenAI-compatible API configuration and calls.
- Send-to-self AI recognition.
- Private chat or group chat arrangement recognition.
- Similarity merging and AI completion inference.
- Calendar view.
- Real notification scheduling or Service Worker Push.
- Message test console changes.

## Technical Notes

- Relevant docs read: `AGENTS.md`, `docs/candidate-rules.md`, `docs/arrangements-requirement-breakdown.md`, `.trellis/spec/frontend/index.md`, `.trellis/spec/frontend/codex-answer-standard.md`.
- Relevant implementation files discovered: `src/App.tsx`, `src/pages/Home.tsx`, `src/settings/preferences.ts`, `src/styles/tokens.css`, `src/data/testConversations.ts`.
- V1 should preserve existing page/state style and avoid introducing router or external state libraries.
