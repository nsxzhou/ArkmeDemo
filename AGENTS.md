# AGENTS.md

This repository uses Trellis for project specs. Before analyzing or changing the project, the AI assistant must read:

- `docs/candidate-rules.md`
- `.trellis/spec/frontend/index.md`
- `.trellis/spec/frontend/codex-answer-standard.md`

Treat `docs/candidate-rules.md` and the Trellis spec as the project-local answer standard. Do not skip them, even for small changes.

## Trellis Spec Source

The detailed rules previously maintained directly in this file have been moved into:

```text
.trellis/spec/frontend/codex-answer-standard.md
```

That Trellis spec is the canonical home for candidate logging, verification, interview upload, and final test-link rules. Keep this file as the lightweight Codex entry point so Codex and other agent-compatible tools can find the Trellis spec.

## Local Git Hook Setup

After reading this file and `docs/candidate-rules.md` for the first time in a fresh clone, run:

```sh
pnpm setup:git-hooks
```

`pnpm install` also runs the same setup automatically. The setup points this repository's local Git hooks at `.githooks/`, so `git push` runs `pnpm verify:answer` before code is submitted to GitHub.

## Pre-Response Log Check

At the beginning of every new user prompt, before answering the new request or making new changes, the AI assistant must check whether the previous iteration has already been recorded in both:

- the current candidate's personal Markdown log under `docs/codex-logs/`
- `src/data/aiConversationLog.ts`

If the previous iteration is missing from either file, write that missing record first. Only after the previous input/output is recorded may the assistant continue analyzing or answering the new prompt.

The AI assistant must also check whether `.codex/candidate-session.json` exists and points to the current candidate's personal Markdown log. If the session file or personal log is missing, stop and ask the candidate to explicitly provide their real name, then run `pnpm codex:init-log -- --name="<候选人姓名>"` before continuing.

Do not write real candidate iterations directly into `docs/codex-iteration-log.md`; that file is only the shared template. The candidate name must come from the candidate's explicit input and cannot be inferred from GitHub, Git config, OS username, email, directory name, or any other machine metadata. The required personal log metadata key is `候选人名称`.

## Required Verification

Before finishing a task, run:

```sh
pnpm verify:answer
```

If only the log format needs checking, run `pnpm verify:codex-log`. If this is the first setup run and no candidate iteration exists yet, use `node scripts/verify-codex-log.mjs --allow-empty`.

## Local Test Links

The project has only two local testing surfaces:

- Mobile Demo: `http://127.0.0.1:5173/`
- Message test console: `http://127.0.0.1:5173/sendtest`

When the final answer describes completed work, include the relevant test link:

- If the iteration changed the Mobile Demo, include `http://127.0.0.1:5173/`.
- If the iteration changed the message test console, include `http://127.0.0.1:5173/sendtest`.
- If both surfaces changed, include both links.
