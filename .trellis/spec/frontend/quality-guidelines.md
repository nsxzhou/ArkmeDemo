# Quality Guidelines

> Code quality standards for ArkmeDemo frontend work.

---

## Overview

The repository uses TypeScript, ESLint, Vite, and Tailwind. `package.json` defines the final verification command:

```sh
pnpm verify:answer
```

It runs lint, production build, Codex log verification, and answer-standard verification.

---

## Forbidden Patterns

- Do not edit `dist/` or generated `*.tsbuildinfo` files.
- Do not write real candidate iterations to `docs/codex-iteration-log.md`; it is only a template.
- Do not infer `候选人名称` from Git, OS user, email, directory name, or other machine metadata.
- Do not create separate Codex history under `docs/codex-archives/` or `src/data/ai-conversation-archives/`.
- Do not add new localStorage keys without checking existing `arkme-demo.*` keys first.
- Do not introduce a router library for the current two-surface app unless a task explicitly requires it.

---

## Required Patterns

- Before changes, read `docs/candidate-rules.md` and confirm previous iteration logging.
- Keep the current candidate Markdown log under `docs/codex-logs/` synchronized with `src/data/aiConversationLog.ts`.
- Preserve UTF-8 text encoding.
- Use path alias imports (`@/...`) for source imports, matching existing files such as `src/App.tsx` and `src/pages/Home.tsx`.
- Keep the mobile demo and `/sendtest` console isolated unless a task explicitly touches both.
- For user-facing completion messages, include `http://127.0.0.1:5173/` when the mobile demo changes and `http://127.0.0.1:5173/sendtest` when the message test console changes.

---

## Testing Requirements

Run the strongest available verification before final response:

```sh
pnpm verify:answer
```

If dependencies are unavailable, document the blocker and run the most relevant narrower check, such as:

```sh
pnpm verify:codex-log
node scripts/verify-codex-log.mjs --allow-empty
```

Frontend behavior changes should also be manually checked on the affected local surface.

---

## Code Review Checklist

- The change matches existing React, TypeScript, and Tailwind style.
- Candidate logging is complete in both required files.
- `AGENTS.md`, `docs/candidate-rules.md`, and Trellis spec remain consistent.
- `pnpm verify:answer` passes or the final answer clearly states why it could not be run.
- The final answer includes the relevant local test link when app behavior changed.
