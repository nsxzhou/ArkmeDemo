import type {
  ArrangementContextRef,
  ArrangementCompletionEvidence,
  ArrangementDraft,
  ArrangementItem,
  ArrangementMergeSuggestion,
  ArrangementParticipant,
  ArrangementReminder,
  ArrangementSourceType,
  ArrangementStatus,
  ArrangementTime,
  ArrangementTimeKind,
} from "@/types/arrangement";

export const arrangementsStorageKey = "arkme-demo.arrangements";
export const arrangementsStorageEvent = "arkme-demo:arrangements-updated";

const demoAnchor = new Date();
demoAnchor.setHours(9, 0, 0, 0);

function timestampFromToday(dayOffset: number, hour: number, minute = 0) {
  const date = new Date(demoAnchor);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

export const demoArrangements: ArrangementItem[] = [
  {
    id: "demo-arrangement-hospital",
    title: "后天去一趟医院",
    description: "把挂号截图和医保卡一起带上，到院后先取号。",
    status: "pending",
    sourceType: "self",
    time: {
      kind: "deadline",
      startAt: timestampFromToday(2, 15),
      originalText: "后天下午",
    },
    location: "市中心医院",
    participants: [{ id: "demo-participant-self", name: "我" }],
    reminders: [{ id: "demo-reminder-hospital", text: "当天上午轻提醒" }],
    contextRefs: [
      {
        sourceType: "self",
        text: "后天去一趟医院",
        senderName: "我",
        sentAt: timestampFromToday(-1, 21, 30),
      },
    ],
    createdAt: timestampFromToday(-1, 21, 30),
    updatedAt: timestampFromToday(-1, 21, 30),
    isDemo: true,
  },
  {
    id: "demo-arrangement-feedback",
    title: "整理面试反馈",
    description: "先把候选人体验、任务拆解和验收风险列出来。",
    status: "in_progress",
    sourceType: "manual",
    time: {
      kind: "fuzzy",
      originalText: "这周内",
      startAt: timestampFromToday(4, 18),
    },
    participants: [],
    reminders: [{ id: "demo-reminder-feedback", text: "周五前看一眼" }],
    contextRefs: [],
    createdAt: timestampFromToday(-2, 10),
    updatedAt: timestampFromToday(-1, 19),
    isDemo: true,
  },
  {
    id: "demo-arrangement-call",
    title: "给妈妈打电话",
    status: "pending",
    sourceType: "manual",
    time: {
      kind: "deadline",
      startAt: timestampFromToday(-1, 20),
      originalText: "昨天晚上 8 点",
    },
    participants: [{ id: "demo-participant-mom", name: "妈妈" }],
    reminders: [{ id: "demo-reminder-call", text: "晚上 8 点提醒" }],
    contextRefs: [],
    createdAt: timestampFromToday(-3, 8),
    updatedAt: timestampFromToday(-3, 8),
    isDemo: true,
  },
  {
    id: "demo-arrangement-swim",
    title: "恢复游泳",
    description: "不用着急，等工作节奏稳定后再开始。",
    status: "later",
    sourceType: "manual",
    time: {
      kind: "fuzzy",
      originalText: "下个月",
      startAt: timestampFromToday(22, 9),
    },
    participants: [],
    reminders: [],
    contextRefs: [],
    createdAt: timestampFromToday(-5, 12),
    updatedAt: timestampFromToday(-1, 9),
    isDemo: true,
  },
];

export function getInitialArrangements() {
  if (typeof window === "undefined") {
    return demoArrangements;
  }

  try {
    const storedValue = window.localStorage.getItem(arrangementsStorageKey);
    if (!storedValue) return demoArrangements;
    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return demoArrangements;
    return parsedValue
      .map(normalizeArrangement)
      .filter((arrangement): arrangement is ArrangementItem => Boolean(arrangement));
  } catch {
    return demoArrangements;
  }
}

export function persistArrangements(arrangements: ArrangementItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(arrangementsStorageKey, JSON.stringify(arrangements));
    window.dispatchEvent(new Event(arrangementsStorageEvent));
  } catch {
    // Keep the in-memory arrangements usable if storage is unavailable.
  }
}

export function createArrangementFromDraft(draft: ArrangementDraft) {
  const now = Date.now();
  const time = createTimeFromDraft(draft);
  const participants = splitTextList(draft.participantsText).map((name, index) => ({
    id: `participant-${now}-${index}`,
    name,
  }));
  const reminders = splitTextList(draft.reminderText).map((text, index) => ({
    id: `reminder-${now}-${index}`,
    text,
  }));

  return {
    id: `arrangement-${now}`,
    title: draft.title.trim(),
    description: normalizeOptionalText(draft.description),
    status: "pending",
    sourceType: "manual",
    time,
    location: normalizeOptionalText(draft.location),
    participants,
    reminders,
    contextRefs: [],
    createdAt: now,
    updatedAt: now,
  } satisfies ArrangementItem;
}

export function createDraftFromArrangement(arrangement: ArrangementItem): ArrangementDraft {
  return {
    title: arrangement.title,
    description: arrangement.description ?? "",
    timeKind: arrangement.time.kind,
    timeText: arrangement.time.originalText ?? "",
    startAt: formatDateTimeInputValue(arrangement.time.startAt),
    location: arrangement.location ?? "",
    participantsText: arrangement.participants.map((participant) => participant.name).join("、"),
    reminderText: arrangement.reminders.map((reminder) => reminder.text).join("、"),
  };
}

export function updateArrangementFromDraft(
  arrangement: ArrangementItem,
  draft: ArrangementDraft
) {
  const now = Date.now();
  return {
    ...arrangement,
    title: draft.title.trim(),
    description: normalizeOptionalText(draft.description),
    time: createTimeFromDraft(draft),
    location: normalizeOptionalText(draft.location),
    participants: splitTextList(draft.participantsText).map((name, index) => ({
      id: arrangement.participants[index]?.id ?? `participant-${now}-${index}`,
      name,
    })),
    reminders: splitTextList(draft.reminderText).map((text, index) => ({
      id: arrangement.reminders[index]?.id ?? `reminder-${now}-${index}`,
      text,
    })),
    updatedAt: now,
  } satisfies ArrangementItem;
}

export function createEmptyArrangementDraft(): ArrangementDraft {
  return {
    title: "",
    description: "",
    timeKind: "fuzzy",
    timeText: "",
    startAt: "",
    location: "",
    participantsText: "",
    reminderText: "",
  };
}

function createTimeFromDraft(draft: ArrangementDraft): ArrangementTime {
  const trimmedTimeText = normalizeOptionalText(draft.timeText);
  const startAt = draft.startAt ? new Date(draft.startAt).getTime() : undefined;
  const validStartAt = typeof startAt === "number" && Number.isFinite(startAt) ? startAt : undefined;

  if (!trimmedTimeText && validStartAt === undefined) {
    return { kind: "none" };
  }

  return {
    kind: draft.timeKind,
    ...(validStartAt !== undefined ? { startAt: validStartAt } : {}),
    ...(trimmedTimeText ? { originalText: trimmedTimeText } : {}),
  };
}

function formatDateTimeInputValue(value: number | undefined) {
  if (value === undefined) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return offsetDate.toISOString().slice(0, 16);
}

function normalizeArrangement(value: unknown): ArrangementItem | null {
  if (!isRecord(value)) return null;
  const title = normalizeOptionalText(value.title);
  const id = normalizeOptionalText(value.id);
  const createdAt = normalizeTimestamp(value.createdAt);
  const updatedAt = normalizeTimestamp(value.updatedAt);

  if (!id || !title || createdAt === null || updatedAt === null) return null;

  return {
    id,
    title,
    description: normalizeOptionalText(value.description),
    status: normalizeStatus(value.status),
    sourceType: normalizeSourceType(value.sourceType),
    time: normalizeTime(value.time),
    location: normalizeOptionalText(value.location),
    participants: normalizeArray(value.participants, normalizeParticipant),
    reminders: normalizeArray(value.reminders, normalizeReminder),
    contextRefs: normalizeArray(value.contextRefs, normalizeContextRef),
    ai: normalizeAiMeta(value.ai),
    mergeSuggestion: normalizeMergeSuggestion(value.mergeSuggestion),
    completionEvidence: normalizeCompletionEvidence(value.completionEvidence),
    createdAt,
    updatedAt,
    isDemo: value.isDemo === true,
  };
}

function normalizeTime(value: unknown): ArrangementTime {
  if (!isRecord(value)) return { kind: "none" };
  const startAt = normalizeTimestamp(value.startAt);
  const endAt = normalizeTimestamp(value.endAt);
  const originalText = normalizeOptionalText(value.originalText);

  return {
    kind: normalizeTimeKind(value.kind),
    ...(startAt !== null ? { startAt } : {}),
    ...(endAt !== null ? { endAt } : {}),
    ...(originalText ? { originalText } : {}),
  };
}

function normalizeParticipant(value: unknown): ArrangementParticipant | null {
  if (!isRecord(value)) return null;
  const id = normalizeOptionalText(value.id);
  const name = normalizeOptionalText(value.name);
  if (!id || !name) return null;
  return { id, name };
}

function normalizeReminder(value: unknown): ArrangementReminder | null {
  if (!isRecord(value)) return null;
  const id = normalizeOptionalText(value.id);
  const text = normalizeOptionalText(value.text);
  const remindAt = normalizeTimestamp(value.remindAt);
  if (!id || !text) return null;
  return {
    id,
    text,
    ...(remindAt !== null ? { remindAt } : {}),
  };
}

function normalizeContextRef(value: unknown): ArrangementContextRef | null {
  if (!isRecord(value)) return null;
  const text = normalizeOptionalText(value.text);
  const sentAt = normalizeTimestamp(value.sentAt);
  if (!text || sentAt === null) return null;

  return {
    sourceType: normalizeContextSourceType(value.sourceType),
    conversationId: normalizeOptionalText(value.conversationId),
    messageId: normalizeOptionalText(value.messageId),
    text,
    senderName: normalizeOptionalText(value.senderName),
    sentAt,
  };
}

function normalizeAiMeta(value: unknown): ArrangementItem["ai"] {
  if (!isRecord(value)) return undefined;
  const confidence = normalizeConfidence(value.confidence);
  if (confidence === null) return undefined;
  return {
    provider: "openai-compatible",
    model: normalizeOptionalText(value.model) ?? "",
    confidence,
    reason: normalizeOptionalText(value.reason),
    needsUserConfirmation: value.needsUserConfirmation === true,
  };
}

function normalizeMergeSuggestion(
  value: unknown
): ArrangementMergeSuggestion | undefined {
  if (!isRecord(value)) return undefined;
  const targetArrangementId = normalizeOptionalText(value.targetArrangementId);
  const targetArrangementTitle = normalizeOptionalText(value.targetArrangementTitle);
  const confidence = normalizeConfidence(value.confidence);
  const createdAt = normalizeTimestamp(value.createdAt);
  if (!targetArrangementId || !targetArrangementTitle || confidence === null) {
    return undefined;
  }

  return {
    targetArrangementId,
    targetArrangementTitle,
    confidence,
    reason: normalizeOptionalText(value.reason),
    createdAt: createdAt ?? Date.now(),
  };
}

function normalizeCompletionEvidence(
  value: unknown
): ArrangementCompletionEvidence | undefined {
  if (!isRecord(value)) return undefined;
  const confidence = normalizeConfidence(value.confidence);
  const sourceText = normalizeOptionalText(value.sourceText);
  const detectedAt = normalizeTimestamp(value.detectedAt);
  if (confidence === null || !sourceText || detectedAt === null) return undefined;

  return {
    model: normalizeOptionalText(value.model) ?? "",
    confidence,
    reason: normalizeOptionalText(value.reason),
    sourceText,
    sourceType: normalizeContextSourceType(value.sourceType),
    conversationId: normalizeOptionalText(value.conversationId),
    messageId: normalizeOptionalText(value.messageId),
    detectedAt,
    previousStatus: normalizeStatus(value.previousStatus),
  };
}

function normalizeArray<T>(value: unknown, normalize: (item: unknown) => T | null) {
  if (!Array.isArray(value)) return [];
  return value.map(normalize).filter((item): item is T => Boolean(item));
}

function normalizeStatus(value: unknown): ArrangementStatus {
  if (
    value === "pending" ||
    value === "in_progress" ||
    value === "completed" ||
    value === "later" ||
    value === "settled"
  ) {
    return value;
  }
  return "pending";
}

function normalizeSourceType(value: unknown): ArrangementSourceType {
  if (
    value === "manual" ||
    value === "self" ||
    value === "private_chat" ||
    value === "group_chat" ||
    value === "ai_update"
  ) {
    return value;
  }
  return "manual";
}

function normalizeContextSourceType(value: unknown): ArrangementContextRef["sourceType"] {
  if (value === "private_chat" || value === "group_chat" || value === "self") {
    return value;
  }
  return "self";
}

function normalizeTimeKind(value: unknown): ArrangementTimeKind {
  if (
    value === "none" ||
    value === "deadline" ||
    value === "time_range" ||
    value === "fuzzy" ||
    value === "recurring"
  ) {
    return value;
  }
  return "none";
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmedValue = value.trim();
  return trimmedValue || undefined;
}

function splitTextList(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isArrangementOverdue(arrangement: ArrangementItem, now = Date.now()) {
  return (
    arrangement.status !== "completed" &&
    arrangement.status !== "later" &&
    arrangement.status !== "settled" &&
    arrangement.time.startAt !== undefined &&
    arrangement.time.startAt < startOfToday(now)
  );
}

export function isArrangementToday(arrangement: ArrangementItem, now = Date.now()) {
  if (arrangement.time.startAt === undefined) return false;
  return startOfToday(arrangement.time.startAt) === startOfToday(now);
}

export function isArrangementUpcoming(arrangement: ArrangementItem, now = Date.now()) {
  if (arrangement.time.startAt === undefined) return false;
  return startOfToday(arrangement.time.startAt) !== startOfToday(now);
}

function startOfToday(value: number) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
