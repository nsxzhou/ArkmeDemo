# Arrangements V4 Merge And Completion

## Goal

Implement V4 of the arrangements module: after V2/V3 creates or observes arrangement-related messages, the app should detect similar existing arrangements for user-confirmed merging and automatically mark arrangements completed only when AI confidence is very high.

## What I Already Know

- V1 arrangements, V2 send-to-self recognition, and V3 private chat recognition are implemented.
- The app is a mobile-first React/Vite demo with local-only storage.
- Existing AI settings use OpenAI-compatible `baseUrl + apiKey + model`.
- Existing `ArrangementItem` already supports `contextRefs`, `ai`, `private_chat`, `self`, and `completed` status.
- Arrangement detail already shows source context and can jump back to private source conversations.

## Requirements

- Scope V4 to send-to-self and private-chat sources only.
- Do not implement group recognition, calendar, real reminders, backend storage, or built-in API keys.
- Add AI settings switches, default enabled:
  - automatic similar arrangement detection
  - automatic high-confidence completion detection
- After self/private recognition creates an arrangement, detect whether it is similar to an existing active arrangement.
- Do not auto-merge similar arrangements. Store a merge suggestion and show it in arrangement detail.
- User-confirmed merge keeps the older arrangement as the primary arrangement.
- Merge confirmation appends source context, participants, reminders, and AI context without duplicating obvious existing entries, then removes the merged arrangement.
- Completion inference should run on new send-to-self messages and private replies when enabled.
- Completion inference only marks an arrangement completed when the model returns an explicit completion signal with `confidence >= 0.9`.
- Automatic completion must preserve AI evidence and provide a visible undo path in arrangement detail.
- Low-confidence, ambiguous, failed, or missing-config completion checks must not change arrangement status.
- Missing API key and API/CORS/parse failures must not block the original message or arrangement creation flows.

## Acceptance Criteria

- Creating two similar self/private arrangements shows a “possible related arrangement” suggestion in arrangement detail.
- Confirming the merge preserves the older arrangement and combines source contexts.
- The merged-away arrangement is removed from the list.
- Sending a clear completion message such as “今天上午已经去医院体检了” can mark the related arrangement completed when confidence is at least 0.9.
- Arrangement detail shows the AI completion evidence and lets the user restore the arrangement.
- Low-confidence completion results leave arrangement status unchanged.
- Existing V2/V3 success, missing-config, and failure paths still work.

## Definition Of Done

- `pnpm lint` passes.
- `pnpm build` passes.
- `pnpm verify:answer` passes.
- Manual browser test covers merge suggestion/confirmation and completion undo.
- `docs/arrangements-requirement-breakdown.md` is updated to mark V4 complete after implementation.
- Candidate log and `src/data/aiConversationLog.ts` are updated before final answer.
