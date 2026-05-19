import {
  getInitialArrangements,
  persistArrangements,
} from "@/data/arrangements";
import type { AiModelSettings } from "@/data/aiModelSettings";
import type {
  ArrangementCompletionEvidence,
  ArrangementContextRef,
  ArrangementItem,
  ArrangementMergeSuggestion,
  ArrangementParticipant,
  ArrangementReminder,
} from "@/types/arrangement";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type SimilarArrangementResult = {
  hasSimilarArrangement: boolean;
  targetArrangementId?: string;
  confidence?: number;
  reason?: string;
};

type CompletionInferenceResult = {
  hasCompletedArrangement: boolean;
  arrangementId?: string;
  confidence?: number;
  reason?: string;
};

type SettlementCandidateResult = {
  arrangementId: string;
  shouldSettle: boolean;
  confidence?: number;
  reason?: string;
};

type SettlementInferenceResult = {
  settledArrangements?: SettlementCandidateResult[];
};

export type ArrangementContinuitySource = {
  text: string;
  sourceType: ArrangementContextRef["sourceType"];
  conversationId?: string;
  messageId?: string;
};

export const arrangementSettlementRunStorageKey =
  "arkme-demo.arrangementContinuity.settlementRun";

const mergeSuggestionConfidenceThreshold = 0.78;
const completionConfidenceThreshold = 0.9;
const settlementConfidenceThreshold = 0.9;
const settlementRunIntervalMs = 60 * 60 * 1000;

export async function detectSimilarArrangementForCreatedItem({
  createdArrangement,
  settings,
}: {
  createdArrangement: ArrangementItem;
  settings: AiModelSettings;
}) {
  if (!settings.autoDetectSimilarArrangements || !settings.apiKey.trim()) return null;

  const arrangements = getInitialArrangements();
  const candidates = arrangements
    .filter((arrangement) => arrangement.id !== createdArrangement.id)
    .filter(isMergeCandidate)
    .slice(0, 8);

  if (candidates.length === 0) return null;

  const result = await requestJsonCompletion<SimilarArrangementResult>({
    settings,
    system:
      "You detect whether a newly created future arrangement should be shown as a possible merge suggestion for one existing arrangement. Return only JSON. The app will not merge automatically; a user must confirm the suggestion. Favor recall for likely same real-world matters: small title differences, one item being more specific than the other, or one item naming the purpose should still count as similar when the time window, place, people, or context overlap. Treat medical visit terms such as hospital, clinic, doctor, appointment, checkup, physical exam, follow-up, registration, medicine pickup, and symptoms as one healthcare-visit matter unless the dates, people, or places clearly conflict. Return false only when they are clearly different matters or there is a concrete conflict.",
    payload: {
      nowIso: new Date().toISOString(),
      timezone: "Asia/Shanghai",
      requiredJsonShape: {
        hasSimilarArrangement: "boolean",
        targetArrangementId: "string id from candidates, empty when none",
        confidence: "number from 0 to 1",
        reason: "short string",
      },
      newArrangement: summarizeArrangement(createdArrangement),
      candidates: candidates.map(summarizeArrangement),
    },
  });

  const targetArrangement = candidates.find(
    (arrangement) => arrangement.id === normalizeText(result.targetArrangementId)
  );
  const confidence = normalizeConfidence(result.confidence);
  if (
    !result.hasSimilarArrangement ||
    !targetArrangement ||
    confidence < mergeSuggestionConfidenceThreshold
  ) {
    return null;
  }

  const suggestion: ArrangementMergeSuggestion = {
    targetArrangementId: targetArrangement.id,
    targetArrangementTitle: targetArrangement.title,
    confidence,
    reason: normalizeText(result.reason),
    createdAt: Date.now(),
  };

  const nextArrangements = getInitialArrangements().map((arrangement) =>
    arrangement.id === createdArrangement.id
      ? { ...arrangement, mergeSuggestion: suggestion, updatedAt: Date.now() }
      : arrangement
  );
  persistArrangements(nextArrangements);

  return suggestion;
}

export async function inferCompletedArrangementFromSource({
  source,
  settings,
}: {
  source: ArrangementContinuitySource;
  settings: AiModelSettings;
}) {
  if (!settings.autoCompleteHighConfidenceArrangements || !settings.apiKey.trim()) {
    return null;
  }

  const arrangements = getInitialArrangements().filter(isCompletionCandidate).slice(0, 10);
  if (arrangements.length === 0) return null;

  const result = await requestJsonCompletion<CompletionInferenceResult>({
    settings,
    system:
      "You detect whether a new user message explicitly says that one existing future arrangement has already been completed. Return only JSON. Only mark complete for clear past-tense completion evidence, not rescheduling, intent, acknowledgement, or vague progress.",
    payload: {
      nowIso: new Date().toISOString(),
      timezone: "Asia/Shanghai",
      requiredJsonShape: {
        hasCompletedArrangement: "boolean",
        arrangementId: "string id from candidates, empty when none",
        confidence: "number from 0 to 1",
        reason: "short string",
      },
      source,
      candidates: arrangements.map(summarizeArrangement),
    },
  });

  const targetArrangement = arrangements.find(
    (arrangement) => arrangement.id === normalizeText(result.arrangementId)
  );
  const confidence = normalizeConfidence(result.confidence);
  if (
    !result.hasCompletedArrangement ||
    !targetArrangement ||
    confidence < completionConfidenceThreshold
  ) {
    return null;
  }

  const evidence: ArrangementCompletionEvidence = {
    model: settings.model,
    confidence,
    reason: normalizeText(result.reason),
    sourceText: source.text,
    sourceType: source.sourceType,
    conversationId: source.conversationId,
    messageId: source.messageId,
    detectedAt: Date.now(),
    previousStatus: targetArrangement.status,
  };

  const nextArrangements = getInitialArrangements().map((arrangement) =>
    arrangement.id === targetArrangement.id
      ? ({
          ...arrangement,
          status: "completed",
          completionEvidence: evidence,
          updatedAt: Date.now(),
        } satisfies ArrangementItem)
      : arrangement
  );
  persistArrangements(nextArrangements);

  return {
    arrangementId: targetArrangement.id,
    arrangementTitle: targetArrangement.title,
    evidence,
  };
}

export function mergeArrangementIntoSuggestedTarget(
  arrangements: ArrangementItem[],
  sourceArrangementId: string
) {
  const sourceArrangement = arrangements.find(
    (arrangement) => arrangement.id === sourceArrangementId
  );
  const targetArrangement = arrangements.find(
    (arrangement) =>
      arrangement.id === sourceArrangement?.mergeSuggestion?.targetArrangementId
  );
  if (!sourceArrangement || !targetArrangement) return arrangements;

  const [primaryArrangement, secondaryArrangement] =
    targetArrangement.createdAt <= sourceArrangement.createdAt
      ? [targetArrangement, sourceArrangement]
      : [sourceArrangement, targetArrangement];
  const now = Date.now();
  const mergedArrangement: ArrangementItem = {
    ...primaryArrangement,
    description: primaryArrangement.description || secondaryArrangement.description,
    location: primaryArrangement.location || secondaryArrangement.location,
    participants: mergeNamedItems(
      primaryArrangement.participants,
      secondaryArrangement.participants,
      "participant",
      primaryArrangement.id,
      now
    ),
    reminders: mergeTextItems(
      primaryArrangement.reminders,
      secondaryArrangement.reminders,
      "reminder",
      primaryArrangement.id,
      now
    ),
    contextRefs: mergeContextRefs(
      primaryArrangement.contextRefs,
      secondaryArrangement.contextRefs
    ),
    ai: primaryArrangement.ai ?? secondaryArrangement.ai,
    mergeSuggestion: undefined,
    updatedAt: now,
  };

  return arrangements
    .filter((arrangement) => arrangement.id !== secondaryArrangement.id)
    .map((arrangement) =>
      arrangement.id === primaryArrangement.id ? mergedArrangement : arrangement
    );
}

export function restoreArrangementFromCompletionEvidence(
  arrangement: ArrangementItem
): ArrangementItem {
  return {
    ...arrangement,
    status: arrangement.completionEvidence?.previousStatus ?? "pending",
    completionEvidence: undefined,
    updatedAt: Date.now(),
  };
}

export async function autoSettleArrangementsAfterCreatedItem({
  createdArrangement,
  settings,
}: {
  createdArrangement: ArrangementItem;
  settings: AiModelSettings;
}) {
  if (!settings.apiKey.trim() || !shouldRunSettlementScan()) return [];

  markSettlementScanRun();

  const arrangements = getInitialArrangements();
  if (arrangements.length === 0) return [];

  const result = await requestJsonCompletion<SettlementInferenceResult>({
    settings,
    system:
      "You help reduce pressure in a gentle future-arrangement list. Return only JSON. You may suggest arrangements to quietly settle when they no longer need active attention, are clearly stale, duplicated by newer context, already fulfilled, or safe to stop surfacing. The app will preserve the previous status and allow undo. Be conservative: do not settle plans that still look time-sensitive, emotionally important, recently created, or explicitly marked as still active.",
    payload: {
      nowIso: new Date().toISOString(),
      timezone: "Asia/Shanghai",
      requiredJsonShape: {
        settledArrangements: [
          {
            arrangementId: "string id from arrangements",
            shouldSettle: "boolean",
            confidence: "number from 0 to 1",
            reason: "short string",
          },
        ],
      },
      triggerArrangement: summarizeArrangement(createdArrangement),
      arrangements: arrangements.map(summarizeArrangement),
    },
  });

  const candidates = Array.isArray(result.settledArrangements)
    ? result.settledArrangements
    : [];
  const settlementById = new Map(
    candidates
      .filter((candidate) => candidate.shouldSettle === true)
      .map((candidate) => [
        normalizeText(candidate.arrangementId),
        {
          confidence: normalizeConfidence(candidate.confidence),
          reason: normalizeText(candidate.reason),
        },
      ])
  );
  const now = Date.now();
  const settledIds: string[] = [];
  const nextArrangements = getInitialArrangements().map((arrangement) => {
    const settlement = settlementById.get(arrangement.id);
    if (
      !settlement ||
      settlement.confidence < settlementConfidenceThreshold ||
      arrangement.status === "settled"
    ) {
      return arrangement;
    }

    settledIds.push(arrangement.id);
    return {
      ...arrangement,
      status: "settled",
      settlementEvidence: {
        model: settings.model,
        confidence: settlement.confidence,
        reason: settlement.reason,
        previousStatus: arrangement.status,
        settledAt: now,
        triggerArrangementId: createdArrangement.id,
      },
      updatedAt: now,
    } satisfies ArrangementItem;
  });

  if (settledIds.length > 0) {
    persistArrangements(nextArrangements);
  }

  return settledIds;
}

export function restoreArrangementFromSettlementEvidence(
  arrangement: ArrangementItem
): ArrangementItem {
  return {
    ...arrangement,
    status: arrangement.settlementEvidence?.previousStatus ?? "pending",
    settlementEvidence: undefined,
    updatedAt: Date.now(),
  };
}

function isMergeCandidate(arrangement: ArrangementItem) {
  return (
    arrangement.status !== "completed" &&
    arrangement.status !== "settled" &&
    !arrangement.isDemo
  );
}

function isCompletionCandidate(arrangement: ArrangementItem) {
  return (
    arrangement.status !== "completed" &&
    arrangement.status !== "settled" &&
    arrangement.status !== "later" &&
    !arrangement.isDemo
  );
}

function summarizeArrangement(arrangement: ArrangementItem) {
  return {
    id: arrangement.id,
    title: arrangement.title,
    description: arrangement.description ?? "",
    status: arrangement.status,
    sourceType: arrangement.sourceType,
    timeText: arrangement.time.originalText ?? "",
    startAtIso: arrangement.time.startAt
      ? new Date(arrangement.time.startAt).toISOString()
      : "",
    location: arrangement.location ?? "",
    participants: arrangement.participants.map((participant) => participant.name),
    contextTexts: arrangement.contextRefs.map((contextRef) => contextRef.text),
    createdAtIso: new Date(arrangement.createdAt).toISOString(),
    updatedAtIso: new Date(arrangement.updatedAt).toISOString(),
    reminderTexts: arrangement.reminders.map((reminder) => reminder.text),
    reminderAtIso: arrangement.reminders
      .map((reminder) =>
        reminder.remindAt ? new Date(reminder.remindAt).toISOString() : ""
      )
      .filter(Boolean),
  };
}

function shouldRunSettlementScan(now = Date.now()) {
  if (typeof window === "undefined") return false;

  try {
    const storedValue = window.localStorage.getItem(
      arrangementSettlementRunStorageKey
    );
    if (!storedValue) return true;
    const parsedValue = JSON.parse(storedValue);
    if (
      !parsedValue ||
      typeof parsedValue !== "object" ||
      typeof parsedValue.lastRunAt !== "number" ||
      !Number.isFinite(parsedValue.lastRunAt)
    ) {
      return true;
    }
    return now - parsedValue.lastRunAt >= settlementRunIntervalMs;
  } catch {
    return true;
  }
}

function markSettlementScanRun(now = Date.now()) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      arrangementSettlementRunStorageKey,
      JSON.stringify({ lastRunAt: now })
    );
  } catch {
    // Settlement scan throttling is best effort.
  }
}

async function requestJsonCompletion<Result>({
  settings,
  system,
  payload,
}: {
  settings: AiModelSettings;
  system: string;
  payload: unknown;
}) {
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
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(payload) },
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

  return JSON.parse(content) as Result;
}

function mergeNamedItems(
  primaryItems: ArrangementParticipant[],
  secondaryItems: ArrangementParticipant[],
  prefix: string,
  arrangementId: string,
  now: number
) {
  const names = new Set(primaryItems.map((item) => item.name));
  const additions = secondaryItems
    .filter((item) => !names.has(item.name))
    .map((item, index) => ({
      id: item.id || `${prefix}-${arrangementId}-${now}-${index}`,
      name: item.name,
    }));
  return [...primaryItems, ...additions];
}

function mergeTextItems(
  primaryItems: ArrangementReminder[],
  secondaryItems: ArrangementReminder[],
  prefix: string,
  arrangementId: string,
  now: number
) {
  const texts = new Set(primaryItems.map((item) => item.text));
  const additions = secondaryItems
    .filter((item) => !texts.has(item.text))
    .map((item, index) => ({
      id: item.id || `${prefix}-${arrangementId}-${now}-${index}`,
      text: item.text,
      remindAt: item.remindAt,
    }));
  return [...primaryItems, ...additions];
}

function mergeContextRefs(
  primaryRefs: ArrangementContextRef[],
  secondaryRefs: ArrangementContextRef[]
) {
  const refKeys = new Set(primaryRefs.map(getContextRefKey));
  const additions = secondaryRefs.filter((contextRef) => {
    const key = getContextRefKey(contextRef);
    if (refKeys.has(key)) return false;
    refKeys.add(key);
    return true;
  });
  return [...primaryRefs, ...additions];
}

function getContextRefKey(contextRef: ArrangementContextRef) {
  return [
    contextRef.sourceType,
    contextRef.conversationId ?? "",
    contextRef.messageId ?? "",
    contextRef.text,
  ].join("|");
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}
