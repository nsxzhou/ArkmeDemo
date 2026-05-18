# Codex Answer Standard

> Project-specific execution rules imported from `AGENTS.md` for Trellis-managed Codex work.

## Source of Truth

- Before analyzing or changing this repository, read `docs/candidate-rules.md`.
- Treat `docs/candidate-rules.md` as the project-local answer standard. Do not skip it for small changes.
- `AGENTS.md` is now a lightweight Codex entry point. The detailed project rules live in this Trellis spec and in `docs/candidate-rules.md`.

## Local Hook Setup

After reading `AGENTS.md` and `docs/candidate-rules.md` for the first time in a fresh clone, run:

```sh
pnpm setup:git-hooks
```

`pnpm install` also runs the same setup through `prepare`. The hook points Git at `.githooks/`, so `git push` runs `pnpm verify:answer`.

## Pre-Response Log Check

At the beginning of every new user prompt, before answering or making changes, check whether the previous iteration has already been recorded in both:

- the current candidate's personal Markdown log under `docs/codex-logs/`
- `src/data/aiConversationLog.ts`

If the previous iteration is missing from either file, write the missing record first. Only after the previous input/output is recorded may the assistant continue with the new prompt.

Also check whether `.codex/candidate-session.json` exists and points to the current candidate's personal Markdown log. If the session file or personal log is missing, stop and ask the candidate to explicitly provide their real name, then run:

```sh
pnpm codex:init-log -- --name="<候选人姓名>"
```

Do not write real candidate iterations directly into `docs/codex-iteration-log.md`; that file is only the shared template. The candidate name must come from the candidate's explicit input and cannot be inferred from GitHub, Git config, OS username, email, directory name, or machine metadata.

## Codex Iteration Log Rule

Every Codex iteration that changes or analyzes the project must append one record to the current candidate's personal Markdown log under `docs/codex-logs/`.

The same iteration must also be appended to:

```text
src/data/aiConversationLog.ts
```

This keeps the in-app sidebar conversation "和AI编程工具对话" synchronized with the current candidate's personal Markdown log.

Do not keep separate Codex history under `docs/codex-archives/` or `src/data/ai-conversation-archives/`. If legacy archive files exist, merge their records into the current unified Markdown log under `docs/codex-logs/` and into `src/data/aiConversationLog.ts`, then remove the archive directories.

Each record must include:

- The candidate name from the `候选人名称` value at the top of the current candidate's personal Markdown log.
- The current local time.
- The candidate's exact prompt or a faithful summary when the prompt is long.
- The AI assistant's final answer for that iteration.
- The files changed in that iteration.
- The verification performed and the result.

Use this Markdown format:

```md
## YYYY-MM-DD HH:mm:ss ZZZ (+0800)

### 用户输入
...

### AI 最终输出
...

### 本轮改动文件
- ...

### 验证结果
- ...
```

In `src/data/aiConversationLog.ts`, append the matching entry to `aiConversationLogEntries` with the same timestamp, user input, AI final output, changed files, and verification result.

## Interview Upload Rule

If the interview upload environment variables are provided, after each Codex iteration has been written to the personal Markdown log and `src/data/aiConversationLog.ts`, run:

```sh
pnpm codex:upload-interview
```

The command registers the candidate session, prepares upload slots for `codex.iteration_markdown` and `codex.iteration_ui_data`, then `PUT`s both updated files to the returned OSS URLs.

The intended meaning of realtime is one upload after each completed user/AI conversation round, not per-second streaming. Each upload sends the full current candidate Markdown log and full current `src/data/aiConversationLog.ts`, including all recorded rounds since that candidate log was initialized; it is not an incremental upload from the moment cloud upload was first enabled.

The default upload service host is `https://team.jotmo.cc`.

Optional environment variables:

- `CODEX_INTERVIEW_API_BASE` to override the default host
- `CODEX_INTERVIEW_CODEX_SESSION_ID`

`candidate_uid` and `exam_key` are signed or reused by the `register` endpoint and then written back to `.codex/candidate-session.json`. Do not invent, derive, or manually provide them.

## Verification

Before finishing a task, run:

```sh
pnpm verify:answer
```

This includes `pnpm lint`, `pnpm build`, `pnpm verify:codex-log`, and `pnpm verify:answer-standard`.

If only the log format needs checking, run:

```sh
pnpm verify:codex-log
```

If this is the first setup run and no candidate iteration exists yet, use:

```sh
node scripts/verify-codex-log.mjs --allow-empty
```

## Final Test Links

The project has only two local testing surfaces:

- Mobile Demo: `http://127.0.0.1:5173/`
- Message test console: `http://127.0.0.1:5173/sendtest`

When the final answer describes completed work, include the relevant test link:

- If the iteration changed the Mobile Demo, include `http://127.0.0.1:5173/`.
- If the iteration changed the message test console, include `http://127.0.0.1:5173/sendtest`.
- If both surfaces changed, include both links.

After the candidate first asks Codex to read `AGENTS.md` and `docs/candidate-rules.md`, make these two available testing links clear when useful, especially after starting or confirming the local dev server.
