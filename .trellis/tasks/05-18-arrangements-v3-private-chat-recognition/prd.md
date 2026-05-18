# Arrangements V3 Private Chat Recognition

## Goal

Implement V3 of the arrangements module: recognize private chat commitments after the demo user replies in a private conversation, then create a high-confidence `private_chat` arrangement with source context and navigation back to the original chat.

## What I Already Know

- V1 arrangements and V2 send-to-self AI recognition are already implemented.
- The app is a mobile-first React/Vite demo with two local surfaces: `/` and `/sendtest`.
- `/sendtest` already supports private and group test messages.
- The mobile demo already supports replying inside a test conversation through `createTestReplyMessage`.
- Existing `ArrangementItem` already supports `private_chat`, `group_chat`, `contextRefs`, and `ai` metadata.
- Existing AI settings use OpenAI-compatible `baseUrl + apiKey + model`.

## Requirements

- Trigger private recognition only after the demo user replies in a private test conversation.
- Do not trigger V3 recognition when receiving a message from the other person.
- Do not trigger V3 recognition for group conversations.
- Use the latest 8 private conversation messages as model context.
- Reuse the existing OpenAI-compatible settings and add `autoRecognizePrivateReplies`, default enabled.
- Persist private recognition state locally under an `arkme-demo.*` localStorage key.
- Deduplicate by `conversationId + replyMessageId`; the same reply can produce at most one recognition terminal state and at most one arrangement.
- Allow retry only for failed/missing-config private recognition states.
- Create an arrangement only when:
  - `hasArrangement === true`
  - `isUserCommitted === true`
  - `confidence >= 0.72`
- For no arrangement, low confidence, or non-committal replies, store a terminal state but do not show chat feedback.
- For missing API key or request/parse failure, show a low-distraction inline feedback card below the triggering reply with a retry path.
- On successful creation, show a lightweight inline card below the triggering reply: `已创建安排：<title>`.
- Clicking the success card opens the Arrangements page and the created arrangement detail.
- The created arrangement must use `sourceType: "private_chat"` and include at least the request message and the reply message in `contextRefs`.
- Arrangement detail source context must support opening the original private conversation and locating the source message.
- Keep V4/V5 out of scope: semantic merging, completion inference, group chat recognition, calendar, reminders, notification delivery, and recurring reminders.

## Acceptance Criteria

- [ ] `/sendtest` private message: `明天来公司帮我带个早餐。`
- [ ] Mobile demo opens that private conversation and replies: `好的。`
- [ ] With valid AI settings, the app creates a private-chat arrangement such as `明天到公司帮对方带早餐`.
- [ ] The inline chat card opens the created arrangement detail.
- [ ] The arrangement detail source area opens the original private chat and locates the source message.
- [ ] Repeating refresh/re-render/retry for the same reply does not create duplicates.
- [ ] Missing API key does not block sending the reply and shows settings/retry feedback.
- [ ] API/CORS/parse failures do not create dirty arrangements and expose retry.
- [ ] Non-committal replies such as `哈哈` or `收到看看` do not create arrangements and do not show noisy feedback.

## Definition Of Done

- `pnpm lint` passes.
- `pnpm build` passes.
- `pnpm verify:answer` passes.
- Manual browser test covers the main private-chat flow and at least one failure/no-config path.
- `docs/arrangements-requirement-breakdown.md` is updated to mark V3 complete after implementation.
- Candidate log and `src/data/aiConversationLog.ts` are updated before final answer.

## Out Of Scope

- Group chat recognition.
- Similar arrangement merging.
- AI completion state inference.
- Calendar overview.
- Real system reminders or browser notification scheduling for arrangements.
- Any backend or built-in API key.

## Technical Notes

- Main files expected to change:
  - `src/data/aiModelSettings.ts`
  - a new or existing recognition data module under `src/data/`
  - `src/pages/Home.tsx`
  - `src/pages/Arrangements.tsx`
  - `src/settings/preferences.ts`
  - `docs/arrangements-requirement-breakdown.md`
- Existing V2 recognition code in `src/data/selfArrangementRecognition.ts` is the closest implementation pattern.
- Existing test conversation model in `src/data/testConversations.ts` provides stable `conversationId`, `message.id`, `sender`, and `conversationType`.
- Existing arrangement storage in `src/data/arrangements.ts` must remain normalized and local-only.
