import {
  getInitialArrangements,
  persistArrangements,
} from "@/data/arrangements";
import type { AiModelSettings } from "@/data/aiModelSettings";
import type { TestIdentity, TestMessage } from "@/data/testConversations";
import type {
  ArrangementContextRef,
  ArrangementItem,
  ArrangementTimeKind,
} from "@/types/arrangement";

export type PrivateArrangementRecognitionStatus =
  | "idle"
  | "recognizing"
  | "created"
  | "none"
  | "low_confidence"
  | "failed"
  | "missing_config";

export type PrivateArrangementRecognitionState = {
  conversationId: string;
  replyMessageId: string;
  status: PrivateArrangementRecognitionStatus;
  createdArrangementId?: string;
  createdArrangementTitle?: string;
  createdArrangement?: ArrangementItem;
  errorMessage?: string;
  updatedAt: number;
};

type PrivateArrangementExtractionResult = {
  hasArrangement: boolean;
  isUserCommitted: boolean;
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

export const privateArrangementRecognitionStorageKey =
  "arkme-demo.arrangementRecognition.private";

const privateRecognitionConfidenceThreshold = 0.72;
const privateRecognitionContextLimit = 8;

export function getInitialPrivateArrangementRecognitionStates() {
  if (typeof window === "undefined") return [];

  try {
    const storedValue = window.localStorage.getItem(
      privateArrangementRecognitionStorageKey
    );
    if (!storedValue) return [];
    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];
    return parsedValue
      .map(normalizeRecognitionState)
      .filter((state): state is PrivateArrangementRecognitionState =>
        Boolean(state)
      );
  } catch {
    return [];
  }
}

export function persistPrivateArrangementRecognitionStates(
  states: PrivateArrangementRecognitionState[]
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      privateArrangementRecognitionStorageKey,
      JSON.stringify(states.map(normalizePersistableRecognitionState))
    );
  } catch {
    // Keep in-memory recognition usable when storage is unavailable.
  }
}

export async function recognizePrivateReplyArrangement({
  conversationId,
  conversationTitle,
  identity,
  messages,
  replyMessage,
  settings,
  existingState,
}: {
  conversationId: string;
  conversationTitle: string;
  identity?: TestIdentity;
  messages: TestMessage[];
  replyMessage: TestMessage;
  settings: AiModelSettings;
  existingState?: PrivateArrangementRecognitionState;
}) {
  if (existingState?.createdArrangementId) {
    return existingState;
  }

  if (!settings.apiKey.trim()) {
    return createPrivateRecognitionState(
      conversationId,
      replyMessage.id,
      "missing_config"
    );
  }

  const existingArrangement = findArrangementByReplyMessageId(replyMessage.id);
  if (existingArrangement) {
    return {
      conversationId,
      replyMessageId: replyMessage.id,
      status: "created",
      createdArrangementId: existingArrangement.id,
      createdArrangementTitle: existingArrangement.title,
      createdArrangement: existingArrangement,
      updatedAt: Date.now(),
    } satisfies PrivateArrangementRecognitionState;
  }

  const contextMessages = messages
    .filter((message) => message.conversationId === conversationId)
    .filter((message) => message.conversationType === "private")
    .filter((message) => message.sentAt <= replyMessage.sentAt)
    .sort((left, right) => left.sentAt - right.sentAt)
    .slice(-privateRecognitionContextLimit);

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
            "You detect whether the user has committed to a future arrangement in a private chat. Return only JSON. Do not create tasks from messages the user did not agree to. If the user is non-committal, joking, or only acknowledging, return hasArrangement false or isUserCommitted false. Resolve relative dates with nowIso and timezone. For tomorrow, the day after tomorrow, Thursday, Zhou Si, and similar weekday phrases, use the nearest reasonable matching date unless the conversation explicitly says a farther date such as next Thursday. If a date is clear but the hour is not, set startAtIso to 00:00 in the provided timezone and keep the original phrase in timeText. If today is the named weekday and context cannot decide whether it means today or next week, leave startAtIso empty.",
        },
        {
          role: "user",
          content: JSON.stringify({
            nowIso: new Date().toISOString(),
            timezone: "Asia/Shanghai",
            conversation: {
              id: conversationId,
              title: conversationTitle,
              otherPersonName: identity?.name ?? conversationTitle,
            },
            triggerReplyMessageId: replyMessage.id,
            requiredJsonShape: {
              hasArrangement: "boolean",
              isUserCommitted: "boolean",
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
              role: message.sender === "demo" ? "me" : "other",
              senderName: message.sender === "demo" ? "我" : identity?.name,
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
  if (!result.hasArrangement || !result.isUserCommitted) {
    return createPrivateRecognitionState(conversationId, replyMessage.id, "none");
  }

  if (
    normalizeConfidence(result.confidence) < privateRecognitionConfidenceThreshold
  ) {
    return createPrivateRecognitionState(
      conversationId,
      replyMessage.id,
      "low_confidence"
    );
  }

  const arrangement = createPrivateArrangementFromExtraction({
    conversationId,
    identity,
    model: settings.model,
    result,
    contextMessages,
    replyMessage,
  });
  const arrangements = getInitialArrangements();
  persistArrangements([arrangement, ...arrangements]);

  return {
    conversationId,
    replyMessageId: replyMessage.id,
    status: "created",
    createdArrangementId: arrangement.id,
    createdArrangementTitle: arrangement.title,
    createdArrangement: arrangement,
    updatedAt: Date.now(),
  } satisfies PrivateArrangementRecognitionState;
}

export function createPrivateRecognitionState(
  conversationId: string,
  replyMessageId: string,
  status: PrivateArrangementRecognitionStatus,
  errorMessage?: string
): PrivateArrangementRecognitionState {
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

function createPrivateArrangementFromExtraction({
  conversationId,
  identity,
  model,
  result,
  contextMessages,
  replyMessage,
}: {
  conversationId: string;
  identity?: TestIdentity;
  model: string;
  result: PrivateArrangementExtractionResult;
  contextMessages: TestMessage[];
  replyMessage: TestMessage;
}): ArrangementItem {
  const now = Date.now();
  const parsedStartAt = normalizeStartAt(result.startAtIso);
  const timeText = normalizeText(result.timeText);
  const contextRefs = createContextRefs({
    conversationId,
    identity,
    contextMessages,
    replyMessage,
  });

  return {
    id: `arrangement-private-${replyMessage.id}-${now}`,
    title: normalizeText(result.title) || replyMessage.text.trim(),
    description: normalizeText(result.description),
    status: "pending",
    sourceType: "private_chat",
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
  conversationId,
  identity,
  contextMessages,
  replyMessage,
}: {
  conversationId: string;
  identity?: TestIdentity;
  contextMessages: TestMessage[];
  replyMessage: TestMessage;
}): ArrangementContextRef[] {
  const latestOtherMessage = [...contextMessages]
    .reverse()
    .find((message) => message.sender === "identity");
  const selectedMessages = [latestOtherMessage, replyMessage]
    .filter((message): message is TestMessage => Boolean(message))
    .filter(
      (message, index, messages) =>
        messages.findIndex((item) => item.id === message.id) === index
    );

  return selectedMessages.map((message) => ({
    sourceType: "private_chat",
    conversationId,
    messageId: `test-${message.id}`,
    text: message.text,
    senderName: message.sender === "demo" ? "我" : identity?.name,
    sentAt: message.sentAt,
  }));
}

function normalizeExtractionResult(
  value: unknown
): PrivateArrangementExtractionResult {
  if (!isRecord(value)) {
    return { hasArrangement: false, isUserCommitted: false };
  }

  return {
    hasArrangement: value.hasArrangement === true,
    isUserCommitted: value.isUserCommitted === true,
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
): PrivateArrangementRecognitionState | null {
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
  state: PrivateArrangementRecognitionState
): PrivateArrangementRecognitionState {
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
): PrivateArrangementRecognitionStatus {
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
