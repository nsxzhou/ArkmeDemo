import {
  getInitialArrangements,
  persistArrangements,
} from "@/data/arrangements";
import type { AiModelSettings } from "@/data/aiModelSettings";
import type {
  ArrangementItem,
  ArrangementTimeKind,
} from "@/types/arrangement";
import type { RecordItem } from "@/types/record";

export type SelfArrangementRecognitionStatus =
  | "idle"
  | "recognizing"
  | "created"
  | "none"
  | "failed"
  | "missing_config";

export type SelfArrangementRecognitionState = {
  recordUid: string;
  status: SelfArrangementRecognitionStatus;
  createdArrangementId?: string;
  createdArrangementTitle?: string;
  createdArrangement?: ArrangementItem;
  errorMessage?: string;
  updatedAt: number;
};

type ArrangementExtractionResult = {
  hasArrangement: boolean;
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

export const selfArrangementRecognitionStorageKey =
  "arkme-demo.arrangementRecognition.self";

export function getInitialSelfArrangementRecognitionStates() {
  if (typeof window === "undefined") return [];

  try {
    const storedValue = window.localStorage.getItem(selfArrangementRecognitionStorageKey);
    if (!storedValue) return [];
    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];
    return parsedValue
      .map(normalizeRecognitionState)
      .filter((state): state is SelfArrangementRecognitionState => Boolean(state));
  } catch {
    return [];
  }
}

export function persistSelfArrangementRecognitionStates(
  states: SelfArrangementRecognitionState[]
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      selfArrangementRecognitionStorageKey,
      JSON.stringify(states.map(normalizePersistableRecognitionState))
    );
  } catch {
    // Keep the in-memory recognition states usable if storage is unavailable.
  }
}

export async function recognizeSelfRecordArrangement({
  record,
  settings,
  existingState,
}: {
  record: RecordItem;
  settings: AiModelSettings;
  existingState?: SelfArrangementRecognitionState;
}) {
  if (existingState?.createdArrangementId) {
    return existingState;
  }

  if (!settings.apiKey.trim()) {
    return createRecognitionState(record.uid, "missing_config");
  }

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
            "You extract future arrangements from a user's private note. Return only JSON. Do not invent facts. If there is no future arrangement, return hasArrangement false.",
        },
        {
          role: "user",
          content: JSON.stringify({
            nowIso: new Date().toISOString(),
            timezone: "Asia/Shanghai",
            requiredJsonShape: {
              hasArrangement: "boolean",
              title: "string",
              description: "string",
              timeKind: "none | deadline | time_range | fuzzy | recurring",
              timeText: "string",
              startAtIso: "ISO datetime string when clear, otherwise empty",
              location: "string",
              participants: ["string"],
              reminders: ["string"],
              confidence: "number from 0 to 1",
              reason: "short string",
            },
            note: record.text_content,
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
  if (!result.hasArrangement) {
    return createRecognitionState(record.uid, "none");
  }

  const arrangement = createSelfArrangementFromExtraction(record, settings.model, result);
  const arrangements = getInitialArrangements();
  persistArrangements([arrangement, ...arrangements]);

  return {
    recordUid: record.uid,
    status: "created",
    createdArrangementId: arrangement.id,
    createdArrangementTitle: arrangement.title,
    createdArrangement: arrangement,
    updatedAt: Date.now(),
  } satisfies SelfArrangementRecognitionState;
}

export function createRecognitionState(
  recordUid: string,
  status: SelfArrangementRecognitionStatus,
  errorMessage?: string
): SelfArrangementRecognitionState {
  return {
    recordUid,
    status,
    ...(errorMessage ? { errorMessage } : {}),
    updatedAt: Date.now(),
  };
}

function createSelfArrangementFromExtraction(
  record: RecordItem,
  model: string,
  result: ArrangementExtractionResult
): ArrangementItem {
  const now = Date.now();
  const parsedStartAt = normalizeStartAt(result.startAtIso);
  const timeText = normalizeText(result.timeText);

  return {
    id: `arrangement-self-${record.uid}-${now}`,
    title: normalizeText(result.title) || record.text_content.trim(),
    description: normalizeText(result.description),
    status: "pending",
    sourceType: "self",
    time: {
      kind: normalizeTimeKind(result.timeKind),
      ...(parsedStartAt !== undefined ? { startAt: parsedStartAt } : {}),
      ...(timeText ? { originalText: timeText } : {}),
    },
    location: normalizeText(result.location),
    participants: normalizeTextList(result.participants).map((name, index) => ({
      id: `participant-${record.uid}-${index}`,
      name,
    })),
    reminders: normalizeTextList(result.reminders).map((text, index) => ({
      id: `reminder-${record.uid}-${index}`,
      text,
    })),
    contextRefs: [
      {
        sourceType: "self",
        conversationId: "send-to-self",
        messageId: record.uid,
        text: record.text_content,
        senderName: "我",
        sentAt: record.send_at,
      },
    ],
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

function normalizeExtractionResult(value: unknown): ArrangementExtractionResult {
  if (!isRecord(value)) return { hasArrangement: false };

  return {
    hasArrangement: value.hasArrangement === true,
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

function normalizeRecognitionState(value: unknown): SelfArrangementRecognitionState | null {
  if (!isRecord(value)) return null;
  const recordUid = normalizeText(value.recordUid);
  const updatedAt =
    typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : null;

  if (!recordUid || updatedAt === null) return null;

  return {
    recordUid,
    status: normalizeRecognitionStatus(value.status),
    createdArrangementId: normalizeText(value.createdArrangementId),
    createdArrangementTitle: normalizeText(value.createdArrangementTitle),
    errorMessage: normalizeText(value.errorMessage),
    updatedAt,
  };
}

function normalizePersistableRecognitionState(
  state: SelfArrangementRecognitionState
): SelfArrangementRecognitionState {
  return {
    recordUid: state.recordUid,
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

function normalizeRecognitionStatus(value: unknown): SelfArrangementRecognitionStatus {
  if (
    value === "recognizing" ||
    value === "created" ||
    value === "none" ||
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
