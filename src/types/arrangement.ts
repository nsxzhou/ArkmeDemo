export type ArrangementStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "later"
  | "settled";

export type ArrangementSourceType =
  | "manual"
  | "self"
  | "private_chat"
  | "group_chat"
  | "ai_update";

export type ArrangementTimeKind =
  | "none"
  | "deadline"
  | "time_range"
  | "fuzzy"
  | "recurring";

export type ArrangementTime = {
  kind: ArrangementTimeKind;
  startAt?: number;
  endAt?: number;
  originalText?: string;
};

export type ArrangementParticipant = {
  id: string;
  name: string;
};

export type ArrangementReminder = {
  id: string;
  text: string;
  remindAt?: number;
};

export type ArrangementContextRef = {
  sourceType: Exclude<ArrangementSourceType, "manual" | "ai_update">;
  conversationId?: string;
  messageId?: string;
  text: string;
  senderName?: string;
  sentAt: number;
};

export type ArrangementAiMeta = {
  provider: "openai-compatible";
  model: string;
  confidence: number;
  reason?: string;
  needsUserConfirmation: boolean;
};

export type ArrangementMergeSuggestion = {
  targetArrangementId: string;
  targetArrangementTitle: string;
  confidence: number;
  reason?: string;
  createdAt: number;
};

export type ArrangementCompletionEvidence = {
  model: string;
  confidence: number;
  reason?: string;
  sourceText: string;
  sourceType: ArrangementContextRef["sourceType"];
  conversationId?: string;
  messageId?: string;
  detectedAt: number;
  previousStatus: ArrangementStatus;
};

export type ArrangementItem = {
  id: string;
  title: string;
  description?: string;
  status: ArrangementStatus;
  sourceType: ArrangementSourceType;
  time: ArrangementTime;
  location?: string;
  participants: ArrangementParticipant[];
  reminders: ArrangementReminder[];
  contextRefs: ArrangementContextRef[];
  ai?: ArrangementAiMeta;
  mergeSuggestion?: ArrangementMergeSuggestion;
  completionEvidence?: ArrangementCompletionEvidence;
  createdAt: number;
  updatedAt: number;
  isDemo?: boolean;
};

export type ArrangementDraft = {
  title: string;
  description: string;
  timeKind: ArrangementTimeKind;
  timeText: string;
  startAt: string;
  location: string;
  participantsText: string;
  reminderText: string;
  reminderAt: string;
};
