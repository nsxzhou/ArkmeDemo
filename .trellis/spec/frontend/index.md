# Frontend Development Guidelines

> Best practices and project rules for the ArkmeDemo frontend.

---

## Overview

ArkmeDemo is a mobile-first React/Vite demo. The app keeps two local surfaces:

- Mobile Demo: `http://127.0.0.1:5173/`
- Message test console: `http://127.0.0.1:5173/sendtest`

Every Codex/Trellis coding task must also obey the project answer and logging rules imported from the original `AGENTS.md`.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Codex Answer Standard](./codex-answer-standard.md) | Candidate log, verification, upload, and final-link rules | Active |
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Active |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Active |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | Active |
| [State Management](./state-management.md) | Local state, global state, server state | Active |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Active |
| [Type Safety](./type-safety.md) | Type patterns, validation | Active |

---

## Pre-Development Checklist

1. Read `docs/candidate-rules.md` and `./codex-answer-standard.md`.
2. Confirm the previous iteration is recorded in the current candidate Markdown log and `src/data/aiConversationLog.ts`.
3. Search existing code before adding new patterns, helpers, storage keys, components, or routes.
4. Keep changes focused on the requested surface.
5. Run `pnpm verify:answer` before final response whenever dependencies are available.

---

**Language**: Trellis spec files are written in English. User-facing assistant replies in this project default to Simplified Chinese.
