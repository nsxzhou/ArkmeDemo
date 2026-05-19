import {
  getInitialArrangements,
  persistArrangements,
} from "@/data/arrangements";
import type { AiModelSettings } from "@/data/aiModelSettings";
import type { TestGroup, TestIdentity, TestMessage } from "@/data/testConversations";
import type {
  ArrangementContextRef,
  ArrangementItem,
  ArrangementTimeKind,
} from "@/types/arrangement";

export type GroupArrangementRecognitionStatus =
  | "idle"
  | "recognizing"
  | "created"
  | "none"
  | "low_confidence"
  | "failed"
  | "missing_config";

export type GroupArrangementRecognitionState = {
  conversationId: string;
  replyMessageId: string;
  status: GroupArrangementRecognitionStatus;
  createdArrangementId?: string;
  createdArrangementTitle?: string;
  createdArrangement?: ArrangementItem;
  errorMessage?: string;
  updatedAt: number;
};

type GroupArrangementExtractionResult = {
  hasArrangement: boolean;
  isUserCommitted: boolean;
  isRelatedToMe: boolean;
  title?: string;
  description?: string;
  timeKind?: ArrangementTimeKind;
  timeText?: string;
  startAtIso?: string;
  location?: string;
  participants?: string[];
  reminders?: string[];
  confidence?: number;
  reason?: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export const groupArrangementRecognitionStorageKey =
  "arkme-demo.arrangementRecognition.group";

const groupRecognitionConfidenceThreshold = 0.8;
const groupRecognitionContextLimit = 12;

export function getInitialGroupArrangementRecognitionStates() {
  if (typeof window === "undefined") return [];

  try {
    const storedValue = window.localStorage.getItem(
      groupArrangementRecognitionStorageKey
    );
    if (!storedValue) return [];
    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];
    return parsedValue
      .map(normalizeRecognitionState)
      .filter((state): state is GroupArrangementRecognitionState =>
        Boolean(state)
      );
  } catch {
    return [];
  }
}

export function persistGroupArrangementRecognitionStates(
  states: GroupArrangementRecognitionState[]
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      groupArrangementRecognitionStorageKey,
      JSON.stringify(states.map(normalizePersistableRecognitionState))
    );
  } catch {
    // Keep in-memory recognition usable when storage is unavailable.
  }
}

export async function recognizeGroupReplyArrangement({
  group,
  identities,
  messages,
  replyMessage,
  settings,
  existingState,
}: {
  group: TestGroup;
  identities: TestIdentity[];
  messages: TestMessage[];
  replyMessage: TestMessage;
  settings: AiModelSettings;
  existingState?: GroupArrangementRecognitionState;
}) {
  if (existingState?.createdArrangementId) {
    return existingState;
  }

  if (!settings.apiKey.trim()) {
    return createGroupRecognitionState(
      group.id,
      replyMessage.id,
      "missing_config"
    );
  }

  const existingArrangement = findArrangementByReplyMessageId(replyMessage.id);
  if (existingArrangement) {
    return {
      conversationId: group.id,
      replyMessageId: replyMessage.id,
      status: "created",
      createdArrangementId: existingArrangement.id,
      createdArrangementTitle: existingArrangement.title,
      createdArrangement: existingArrangement,
      updatedAt: Date.now(),
    } satisfies GroupArrangementRecognitionState;
  }

  const identityById = new Map(identities.map((identity) => [identity.id, identity]));
  const contextMessages = messages
    .filter((message) => message.conversationId === group.id)
    .filter((message) => message.conversationType === "group")
    .filter((message) => message.sentAt <= replyMessage.sentAt)
    .sort((left, right) => left.sentAt - right.sentAt)
    .slice(-groupRecognitionContextLimit);

  const endpoint = `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You detect whether the user has committed to a future arrangement in a group chat. Return only JSON. Only create a plan when the trigger reply makes the arrangement related to the user. Combine consecutive item additions such as A, B, and C into one arrangement. Do not create plans for other group members' tasks. Resolve relative dates with nowIso and timezone. For tomorrow, the day after tomorrow, Thursday, Zhou Si, and similar weekday phrases, use the nearest reasonable matching date unless the conversation explicitly says a farther date such as next Thursday. If a date is clear but the hour is not, set startAtIso to 00:00 in the provided timezone and keep the original phrase in timeText. If today is the named weekday and context cannot decide whether it means today or next week, leave startAtIso empty.",
        },
        {
          role: "user",
          content: JSON.stringify({
            nowIso: new Date().toISOString(),
            timezone: "Asia/Shanghai",
            group: {
              id: group.id,
              name: group.name,
              note: group.note,
            },
            triggerReplyMessageId: replyMessage.id,
            requiredJsonShape: {
              hasArrangement: "boolean",
              isUserCommitted: "boolean",
              isRelatedToMe: "boolean",
              title: "string",
              description: "string",
              timeKind: "none | deadline | time_range | fuzzy | recurring",
              timeText: "string",
              startAtIso:
                "ISO datetime string when the date is clear or inferable from nowIso and timezone, otherwise empty",
              location: "string",
              participants: ["string"],
              reminders: ["string"],
              confidence: "number from 0 to 1",
              reason: "short string",
            },
            messages: contextMessages.map((message) => ({
              id: message.id,
              role: message.sender === "demo" ? "me" : "group_member",
              senderName:
                message.sender === "demo"
                  ? "我"
                  : identityById.get(message.identityId)?.name ?? "群成员",
              text: message.text,
              sentAtIso: new Date(message.sentAt).toISOString(),
              isTriggerReply: message.id === replyMessage.id,
            })),
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const completion = (await response.json()) as ChatCompletionResponse;
  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty model response");
  }

  const result = normalizeExtractionResult(JSON.parse(content));
  if (!result.hasArrangement || !result.isUserCommitted || !result.isRelatedToMe) {
    return createGroupRecognitionState(group.id, replyMessage.id, "none");
  }

  if (normalizeConfidence(result.confidence) < groupRecognitionConfidenceThreshold) {
    return createGroupRecognitionState(group.id, replyMessage.id, "low_confidence");
  }

  const arrangement = createGroupArrangementFromExtraction({
    group,
    identityById,
    model: settings.model,
    result,
    contextMessages,
    replyMessage,
  });
  const arrangements = getInitialArrangements();
  persistArrangements([arrangement, ...arrangements]);

  return {
    conversationId: group.id,
    replyMessageId: replyMessage.id,
    status: "created",
    createdArrangementId: arrangement.id,
    createdArrangementTitle: arrangement.title,
    createdArrangement: arrangement,
    updatedAt: Date.now(),
  } satisfies GroupArrangementRecognitionState;
}

export function createGroupRecognitionState(
  conversationId: string,
  replyMessageId: string,
  status: GroupArrangementRecognitionStatus,
  errorMessage?: string
): GroupArrangementRecognitionState {
  return {
    conversationId,
    replyMessageId,
    status,
    ...(errorMessage ? { errorMessage } : {}),
    updatedAt: Date.now(),
  };
}

function findArrangementByReplyMessageId(replyMessageId: string) {
  const recordUid = `test-${replyMessageId}`;
  return getInitialArrangements().find((arrangement) =>
    arrangement.contextRefs.some(
      (contextRef) =>
        contextRef.messageId === replyMessageId || contextRef.messageId === recordUid
    )
  );
}

function createGroupArrangementFromExtraction({
  group,
  identityById,
  model,
  result,
  contextMessages,
  replyMessage,
}: {
  group: TestGroup;
  identityById: Map<string, TestIdentity>;
  model: string;
  result: GroupArrangementExtractionResult;
  contextMessages: TestMessage[];
  replyMessage: TestMessage;
}): ArrangementItem {
  const now = Date.now();
  const parsedStartAt = normalizeStartAt(result.startAtIso);
  const timeText = normalizeText(result.timeText);
  const contextRefs = createContextRefs({
    group,
    identityById,
    contextMessages,
    replyMessage,
  });

  return {
    id: `arrangement-group-${replyMessage.id}-${now}`,
    title: normalizeText(result.title) || replyMessage.text.trim(),
    description: normalizeText(result.description),
    status: "pending",
    sourceType: "group_chat",
    time: {
      kind: normalizeTimeKind(result.timeKind),
      ...(parsedStartAt !== undefined ? { startAt: parsedStartAt } : {}),
      ...(timeText ? { originalText: timeText } : {}),
    },
    location: normalizeText(result.location),
    participants: normalizeTextList(result.participants).map((name, index) => ({
      id: `participant-${replyMessage.id}-${index}`,
      name,
    })),
    reminders: normalizeTextList(result.reminders).map((text, index) => ({
      id: `reminder-${replyMessage.id}-${index}`,
      text,
    })),
    contextRefs,
    ai: {
      provider: "openai-compatible",
      model,
      confidence: normalizeConfidence(result.confidence),
      reason: normalizeText(result.reason),
      needsUserConfirmation: false,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function createContextRefs({
  group,
  identityById,
  contextMessages,
  replyMessage,
}: {
  group: TestGroup;
  identityById: Map<string, TestIdentity>;
  contextMessages: TestMessage[];
  replyMessage: TestMessage;
}): ArrangementContextRef[] {
  const selectedMessages = contextMessages.filter((message) => {
    if (message.id === replyMessage.id) return true;
    return message.sender === "identity";
  });

  return selectedMessages.map((message) => ({
    sourceType: "group_chat",
    conversationId: group.id,
    messageId: `test-${message.id}`,
    text: message.text,
    senderName:
      message.sender === "demo"
        ? "我"
        : identityById.get(message.identityId)?.name ?? "群成员",
    sentAt: message.sentAt,
  }));
}

function normalizeExtractionResult(
  value: unknown
): GroupArrangementExtractionResult {
  if (!isRecord(value)) {
    return {
      hasArrangement: false,
      isUserCommitted: false,
      isRelatedToMe: false,
    };
  }

  return {
    hasArrangement: value.hasArrangement === true,
    isUserCommitted: value.isUserCommitted === true,
    isRelatedToMe: value.isRelatedToMe === true,
    title: normalizeText(value.title),
    description: normalizeText(value.description),
    timeKind: normalizeTimeKind(value.timeKind),
    timeText: normalizeText(value.timeText),
    startAtIso: normalizeText(value.startAtIso),
    location: normalizeText(value.location),
    participants: normalizeTextList(value.participants),
    reminders: normalizeTextList(value.reminders),
    confidence: normalizeConfidence(value.confidence),
    reason: normalizeText(value.reason),
  };
}

function normalizeRecognitionState(
  value: unknown
): GroupArrangementRecognitionState | null {
  if (!isRecord(value)) return null;
  const conversationId = normalizeText(value.conversationId);
  const replyMessageId = normalizeText(value.replyMessageId);
  const updatedAt =
    typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : null;

  if (!conversationId || !replyMessageId || updatedAt === null) return null;

  return {
    conversationId,
    replyMessageId,
    status: normalizeRecognitionStatus(value.status),
    createdArrangementId: normalizeText(value.createdArrangementId),
    createdArrangementTitle: normalizeText(value.createdArrangementTitle),
    errorMessage: normalizeText(value.errorMessage),
    updatedAt,
  };
}

function normalizePersistableRecognitionState(
  state: GroupArrangementRecognitionState
): GroupArrangementRecognitionState {
  return {
    conversationId: state.conversationId,
    replyMessageId: state.replyMessageId,
    status: state.status,
    ...(state.createdArrangementId
      ? { createdArrangementId: state.createdArrangementId }
      : {}),
    ...(state.createdArrangementTitle
      ? { createdArrangementTitle: state.createdArrangementTitle }
      : {}),
    ...(state.errorMessage ? { errorMessage: state.errorMessage } : {}),
    updatedAt: state.updatedAt,
  };
}

function normalizeRecognitionStatus(
  value: unknown
): GroupArrangementRecognitionStatus {
  if (
    value === "recognizing" ||
    value === "created" ||
    value === "none" ||
    value === "low_confidence" ||
    value === "failed" ||
    value === "missing_config"
  ) {
    return value;
  }
  return "idle";
}

function normalizeTimeKind(value: unknown): ArrangementTimeKind {
  if (
    value === "deadline" ||
    value === "time_range" ||
    value === "fuzzy" ||
    value === "recurring" ||
    value === "none"
  ) {
    return value;
  }
  return "none";
}

function normalizeStartAt(value: unknown) {
  const text = normalizeText(value);
  if (!text) return undefined;
  const timestamp = new Date(text).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeTextList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeText)
    .filter((text): text is string => Boolean(text));
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
