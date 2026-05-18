export type AiModelSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
  autoRecognizeSelfMessages: boolean;
  autoRecognizePrivateReplies: boolean;
};

export const aiModelSettingsStorageKey = "arkme-demo.aiModelSettings";

export const defaultAiModelSettings: AiModelSettings = {
  baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
  apiKey: "",
  model: "mimo-v2.5",
  autoRecognizeSelfMessages: true,
  autoRecognizePrivateReplies: true,
};

export function getInitialAiModelSettings() {
  if (typeof window === "undefined") return defaultAiModelSettings;

  try {
    const storedValue = window.localStorage.getItem(aiModelSettingsStorageKey);
    if (!storedValue) return defaultAiModelSettings;
    return normalizeAiModelSettings(JSON.parse(storedValue));
  } catch {
    return defaultAiModelSettings;
  }
}

export function persistAiModelSettings(settings: AiModelSettings) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      aiModelSettingsStorageKey,
      JSON.stringify(normalizeAiModelSettings(settings))
    );
  } catch {
    // Keep the in-memory settings usable if storage is unavailable.
  }
}

function normalizeAiModelSettings(value: unknown): AiModelSettings {
  if (!isRecord(value)) return defaultAiModelSettings;

  return {
    baseUrl: normalizeText(value.baseUrl) || defaultAiModelSettings.baseUrl,
    apiKey: normalizeText(value.apiKey),
    model: normalizeText(value.model) || defaultAiModelSettings.model,
    autoRecognizeSelfMessages:
      typeof value.autoRecognizeSelfMessages === "boolean"
        ? value.autoRecognizeSelfMessages
        : defaultAiModelSettings.autoRecognizeSelfMessages,
    autoRecognizePrivateReplies:
      typeof value.autoRecognizePrivateReplies === "boolean"
        ? value.autoRecognizePrivateReplies
        : defaultAiModelSettings.autoRecognizePrivateReplies,
  };
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
