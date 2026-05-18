# Arrangements V2 AI Self Recognition

## Goal

Deliver V2 of the Arrangements module: when the user sends content in "Send to self", the mobile demo automatically calls an OpenAI-compatible model to detect whether the message contains an arrangement. If it does, the app directly creates an arrangement and shows a lightweight chat-side result.

## What I Already Know

- V1 Arrangements is complete and archived: bottom tab, list, manual create/edit/detail, complete, later, delete, demo data, and `arkme-demo.arrangements` persistence already exist.
- The repo is a React/Vite/TypeScript mobile-first frontend with no backend proxy.
- `/sendtest` is not part of this V2 scope.
- `SendToSelfConversationChat` currently saves user content as quick notes through `createSelfRecord`.
- `SettingsScreen` currently contains appearance and language only.
- The user explicitly chose automatic recognition and direct arrangement creation.
- Source code must not contain the provided API key. The key is user-provided in local settings only.

## Requirements

- Add AI model settings under Mine > Settings:
  - default `baseUrl` is `https://token-plan-cn.xiaomimimo.com/v1`
  - default `model` is `mimo-v2.5`
  - `apiKey` is entered locally in a password field and persisted only in localStorage
  - `autoRecognizeSelfMessages` defaults to enabled
- Add an OpenAI-compatible Chat Completions client:
  - call `POST {baseUrl}/chat/completions`
  - send `model`, `messages`, and `response_format: { "type": "json_object" }`
  - ask the model to return only JSON with arrangement extraction fields
  - pass current local time and `Asia/Shanghai`
- After a new Send-to-self message is saved:
  - if auto recognition is enabled and `apiKey` exists, start recognition immediately
  - if the model says there is an arrangement, create one `ArrangementItem`
  - created item uses `sourceType: "self"` and context refs pointing at the original self record
  - `ai.needsUserConfirmation` is `false`
  - one self record may create at most one arrangement
- UI feedback in Send to self:
  - show recognizing, created, no arrangement, or failed states inline near the relevant message
  - created state links to the created arrangement detail
  - missing API key shows a low-disruption setup hint, not a blocking modal
- Failure behavior:
  - quick note creation always succeeds independently of AI
  - missing config, network/CORS failure, API failure, and invalid JSON do not create arrangements
  - failed state supports retry for the same record without duplicate creation

## Out of Scope

- Private chat recognition.
- Group chat recognition.
- Cross-message or cross-source merge/deduplication.
- AI completion inference.
- Calendar view.
- Real notification delivery.
- Backend proxy or server-side secret storage.
- Historical batch scan for old Send-to-self messages.

## Acceptance Criteria

- [x] Settings shows default `baseUrl` and `model`, hides `apiKey`, and persists user changes locally.
- [x] Sending "后天去一趟医院" in Send to self triggers recognition automatically when configured.
- [x] A matched result creates a visible arrangement without user confirmation.
- [x] Send-to-self chat shows "已创建安排" style feedback and opens the created arrangement detail.
- [x] Refresh keeps arrangements and recognition status.
- [x] Retrying or refreshing the same message does not create duplicate arrangements.
- [x] Missing API key does not call the API and shows a setup hint.
- [x] API/CORS/parse failures preserve the quick note and show retryable failure state.
- [x] `pnpm lint`, `pnpm build`, and `pnpm verify:answer` pass.

## Technical Notes

- Prefer path alias imports (`@/...`).
- Keep mobile demo and `/sendtest` isolated.
- Keep API key out of source, logs, docs, and final answer.
- Use UTF-8 text.
- UI should follow existing mobile native style and Frontend Design guidance with a refined, low-pressure treatment.
