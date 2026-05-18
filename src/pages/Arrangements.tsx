import React from "react";
import {
  createArrangementFromDraft,
  createDraftFromArrangement,
  createEmptyArrangementDraft,
  demoArrangements,
  getInitialArrangements,
  isArrangementOverdue,
  isArrangementToday,
  isArrangementUpcoming,
  persistArrangements,
  updateArrangementFromDraft,
} from "@/data/arrangements";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/settings/preferences";
import type {
  ArrangementDraft,
  ArrangementItem,
  ArrangementStatus,
  ArrangementTimeKind,
} from "@/types/arrangement";

type ArrangementGroup = {
  key: string;
  title: string;
  description: string;
  items: ArrangementItem[];
};

const timeKindOptions: ArrangementTimeKind[] = [
  "fuzzy",
  "deadline",
  "time_range",
  "recurring",
  "none",
];

export default function Arrangements({
  targetArrangementId,
  onTargetHandled,
}: {
  targetArrangementId?: string | null;
  onTargetHandled?: () => void;
}) {
  const { resolvedLocale, t } = usePreferences();
  const [arrangements, setArrangements] = React.useState(getInitialArrangements);
  const [editingArrangement, setEditingArrangement] = React.useState<ArrangementItem | null>(null);
  const [viewingArrangement, setViewingArrangement] = React.useState<ArrangementItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);

  const groups = React.useMemo(
    () => getArrangementGroups(arrangements, t),
    [arrangements, t]
  );
  const activeCount = arrangements.filter(
    (arrangement) =>
      arrangement.status !== "completed" && arrangement.status !== "settled"
  ).length;
  const demoCount = arrangements.filter((arrangement) => arrangement.isDemo).length;

  const replaceArrangements = React.useCallback((nextArrangements: ArrangementItem[]) => {
    setArrangements(nextArrangements);
    persistArrangements(nextArrangements);
  }, []);

  React.useEffect(() => {
    if (!targetArrangementId) return;
    const targetArrangement = arrangements.find(
      (arrangement) => arrangement.id === targetArrangementId
    );
    if (targetArrangement) {
      setViewingArrangement(targetArrangement);
    }
    onTargetHandled?.();
  }, [arrangements, onTargetHandled, targetArrangementId]);

  const openCreateSheet = () => {
    setEditingArrangement(null);
    setIsEditorOpen(true);
  };

  const openEditSheet = (arrangement: ArrangementItem) => {
    setEditingArrangement(arrangement);
    setIsEditorOpen(true);
  };

  const handleSaveDraft = (draft: ArrangementDraft) => {
    if (editingArrangement) {
      const updatedArrangement = updateArrangementFromDraft(editingArrangement, draft);
      replaceArrangements(
        arrangements.map((arrangement) =>
          arrangement.id === editingArrangement.id ? updatedArrangement : arrangement
        )
      );
      setViewingArrangement(updatedArrangement);
    } else {
      replaceArrangements([createArrangementFromDraft(draft), ...arrangements]);
    }
    setIsEditorOpen(false);
    setEditingArrangement(null);
  };

  const updateArrangementStatus = (arrangementId: string, status: ArrangementStatus) => {
    const now = Date.now();
    let nextViewingArrangement: ArrangementItem | null = null;
    const nextArrangements = arrangements.map((arrangement) => {
      if (arrangement.id !== arrangementId) return arrangement;
      const updatedArrangement = {
        ...arrangement,
        status,
        updatedAt: now,
      };
      nextViewingArrangement = updatedArrangement;
      return updatedArrangement;
    });
    replaceArrangements(nextArrangements);
    setViewingArrangement(nextViewingArrangement);
  };

  const deleteArrangement = (arrangementId: string) => {
    replaceArrangements(
      arrangements.filter((arrangement) => arrangement.id !== arrangementId)
    );
    setViewingArrangement(null);
  };

  const clearDemoArrangements = () => {
    replaceArrangements(arrangements.filter((arrangement) => !arrangement.isDemo));
    setViewingArrangement(null);
  };

  const restoreDemoArrangements = () => {
    const userArrangements = arrangements.filter((arrangement) => !arrangement.isDemo);
    replaceArrangements([...demoArrangements, ...userArrangements]);
  };

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <header className="shrink-0 bg-bg px-4 pb-2 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] leading-4 text-text-tertiary">
              {t("arrangements.eyebrow")}
            </p>
            <h1 className="mt-1 text-[24px] font-semibold leading-8 text-text">
              {t("arrangements.title")}
            </h1>
            <p className="mt-1 max-w-[230px] text-[12px] leading-5 text-text-muted">
              {t("arrangements.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateSheet}
            className="flex h-10 shrink-0 items-center rounded-full bg-primary px-3 text-[14px] font-medium leading-5 text-on-primary shadow-[0_8px_22px_rgba(9,184,62,0.2)] transition active:scale-[0.97]"
          >
            <PlusIcon className="mr-1.5 h-4 w-4" />
            {t("arrangements.create")}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <ArrangementMetric label={t("arrangements.metricActive")} value={activeCount} />
          <ArrangementMetric
            label={t("arrangements.metricCompleted")}
            value={arrangements.filter((arrangement) => arrangement.status === "completed").length}
          />
          <ArrangementMetric
            label={t("arrangements.metricLater")}
            value={arrangements.filter((arrangement) => arrangement.status === "later").length}
          />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-5">
        {demoCount > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-[12px] border border-border-light bg-surface px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-medium leading-5 text-text">
                {t("arrangements.demoTitle")}
              </p>
              <p className="truncate text-[11px] leading-4 text-text-tertiary">
                {t("arrangements.demoDesc")}
              </p>
            </div>
            <button
              type="button"
              onClick={clearDemoArrangements}
              className="ml-3 shrink-0 rounded-full bg-surface-muted px-3 py-1.5 text-[12px] font-medium leading-4 text-text-muted transition active:scale-[0.98]"
            >
              {t("arrangements.clearDemo")}
            </button>
          </div>
        )}

        {arrangements.length === 0 ? (
          <ArrangementEmptyState
            onCreate={openCreateSheet}
            onRestoreDemo={restoreDemoArrangements}
          />
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <ArrangementGroupSection
                key={group.key}
                group={group}
                resolvedLocale={resolvedLocale}
                onOpen={setViewingArrangement}
              />
            ))}
          </div>
        )}
      </main>

      {isEditorOpen && (
        <ArrangementEditorSheet
          arrangement={editingArrangement}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingArrangement(null);
          }}
          onSave={handleSaveDraft}
        />
      )}

      {viewingArrangement && (
        <ArrangementDetailSheet
          arrangement={viewingArrangement}
          resolvedLocale={resolvedLocale}
          onClose={() => setViewingArrangement(null)}
          onEdit={() => openEditSheet(viewingArrangement)}
          onComplete={() => updateArrangementStatus(viewingArrangement.id, "completed")}
          onLater={() => updateArrangementStatus(viewingArrangement.id, "later")}
          onRestore={() => updateArrangementStatus(viewingArrangement.id, "pending")}
          onDelete={() => deleteArrangement(viewingArrangement.id)}
        />
      )}
    </div>
  );
}

function ArrangementMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] border border-border-light bg-surface px-2.5 py-2">
      <p className="text-[18px] font-semibold leading-6 text-text">{value}</p>
      <p className="mt-0.5 truncate text-[11px] leading-4 text-text-tertiary">{label}</p>
    </div>
  );
}

function ArrangementGroupSection({
  group,
  resolvedLocale,
  onOpen,
}: {
  group: ArrangementGroup;
  resolvedLocale: string;
  onOpen: (arrangement: ArrangementItem) => void;
}) {
  if (group.items.length === 0) return null;

  return (
    <section>
      <div className="mb-2 px-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold leading-5 text-text">
            {group.title}
          </h2>
          <span className="text-[11px] leading-4 text-text-tertiary">
            {group.items.length}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-4 text-text-tertiary">
          {group.description}
        </p>
      </div>
      <div className="space-y-2">
        {group.items.map((arrangement) => (
          <ArrangementCard
            key={arrangement.id}
            arrangement={arrangement}
            resolvedLocale={resolvedLocale}
            onOpen={() => onOpen(arrangement)}
          />
        ))}
      </div>
    </section>
  );
}

function ArrangementCard({
  arrangement,
  resolvedLocale,
  onOpen,
}: {
  arrangement: ArrangementItem;
  resolvedLocale: string;
  onOpen: () => void;
}) {
  const { t } = usePreferences();
  const overdue = isArrangementOverdue(arrangement);
  const metaItems = [
    formatArrangementTime(arrangement, resolvedLocale, t),
    arrangement.location,
    arrangement.participants.map((participant) => participant.name).join("、"),
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[14px] border border-border-light bg-surface px-3 py-3 text-left shadow-[var(--mine-card-shadow)] transition active:scale-[0.99]"
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
            arrangement.status === "completed"
              ? "bg-success"
              : arrangement.status === "later"
                ? "bg-warning"
                : "bg-primary"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                "min-w-0 flex-1 text-[15px] font-semibold leading-5 text-text",
                arrangement.status === "completed" && "text-text-tertiary line-through"
              )}
            >
              {arrangement.title}
            </h3>
            <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] leading-4 text-text-tertiary">
              {getStatusLabel(arrangement.status, t)}
            </span>
          </div>
          {arrangement.description && (
            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-text-muted">
              {arrangement.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {metaItems.map((item) => (
              <span
                key={item}
                className="rounded-full bg-[var(--overview-entry-tag-bg)] px-2 py-1 text-[11px] leading-4 text-text-tertiary"
              >
                {item}
              </span>
            ))}
          </div>
          {overdue && (
            <p className="mt-2 rounded-[10px] bg-surface-muted px-2 py-1 text-[11px] leading-4 text-text-muted">
              {t("arrangements.gentleOverdue")}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function ArrangementEmptyState({
  onCreate,
  onRestoreDemo,
}: {
  onCreate: () => void;
  onRestoreDemo: () => void;
}) {
  const { t } = usePreferences();

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center px-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary">
        <CalendarIcon className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-[17px] font-semibold leading-6 text-text">
        {t("arrangements.emptyTitle")}
      </h2>
      <p className="mt-2 text-[13px] leading-5 text-text-muted">
        {t("arrangements.emptyDesc")}
      </p>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onCreate}
          className="rounded-full bg-primary px-4 py-2 text-[14px] font-medium leading-5 text-on-primary transition active:scale-[0.98]"
        >
          {t("arrangements.createFirst")}
        </button>
        <button
          type="button"
          onClick={onRestoreDemo}
          className="rounded-full bg-surface px-4 py-2 text-[14px] font-medium leading-5 text-text-muted transition active:scale-[0.98]"
        >
          {t("arrangements.restoreDemo")}
        </button>
      </div>
    </div>
  );
}

function ArrangementEditorSheet({
  arrangement,
  onClose,
  onSave,
}: {
  arrangement: ArrangementItem | null;
  onClose: () => void;
  onSave: (draft: ArrangementDraft) => void;
}) {
  const { t } = usePreferences();
  const [draft, setDraft] = React.useState<ArrangementDraft>(
    arrangement ? createDraftFromArrangement(arrangement) : createEmptyArrangementDraft()
  );
  const canSave = draft.title.trim().length > 0;

  const updateDraft = <Key extends keyof ArrangementDraft>(
    key: Key,
    value: ArrangementDraft[Key]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <SheetFrame onClose={onClose}>
      <div className="flex items-center justify-between border-b border-border-light px-4 pb-3 pt-4">
        <div>
          <h2 className="text-[18px] font-semibold leading-6 text-text">
            {arrangement ? t("arrangements.editTitle") : t("arrangements.createTitle")}
          </h2>
          <p className="mt-0.5 text-[12px] leading-4 text-text-tertiary">
            {t("arrangements.editorDesc")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={!canSave}
          className="rounded-full bg-primary px-4 py-2 text-[14px] font-medium leading-5 text-on-primary transition disabled:bg-surface-muted disabled:text-text-disabled active:scale-[0.98]"
        >
          {t("common.done")}
        </button>
      </div>

      <div className="max-h-[68vh] overflow-y-auto px-4 pb-5 pt-3">
        <ArrangementField label={t("arrangements.fieldTitle")}>
          <input
            value={draft.title}
            onChange={(event) => updateDraft("title", event.target.value)}
            className="h-11 w-full rounded-[12px] bg-bg px-3 text-[15px] text-text outline-none focus-glow"
            placeholder={t("arrangements.fieldTitlePlaceholder")}
          />
        </ArrangementField>
        <ArrangementField label={t("arrangements.fieldDescription")}>
          <textarea
            value={draft.description}
            onChange={(event) => updateDraft("description", event.target.value)}
            className="min-h-[76px] w-full resize-none rounded-[12px] bg-bg px-3 py-2 text-[14px] leading-5 text-text outline-none focus-glow"
            placeholder={t("arrangements.fieldDescriptionPlaceholder")}
          />
        </ArrangementField>
        <ArrangementField label={t("arrangements.fieldTime")}>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={draft.timeKind}
              onChange={(event) =>
                updateDraft("timeKind", event.target.value as ArrangementTimeKind)
              }
              className="h-11 rounded-[12px] bg-bg px-3 text-[14px] text-text outline-none focus-glow"
            >
              {timeKindOptions.map((option) => (
                <option key={option} value={option}>
                  {getTimeKindLabel(option, t)}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={draft.startAt}
              onChange={(event) => updateDraft("startAt", event.target.value)}
              className="h-11 min-w-0 rounded-[12px] bg-bg px-2 text-[12px] text-text outline-none focus-glow"
            />
          </div>
          <input
            value={draft.timeText}
            onChange={(event) => updateDraft("timeText", event.target.value)}
            className="mt-2 h-11 w-full rounded-[12px] bg-bg px-3 text-[14px] text-text outline-none focus-glow"
            placeholder={t("arrangements.fieldTimePlaceholder")}
          />
        </ArrangementField>
        <ArrangementField label={t("arrangements.fieldLocation")}>
          <input
            value={draft.location}
            onChange={(event) => updateDraft("location", event.target.value)}
            className="h-11 w-full rounded-[12px] bg-bg px-3 text-[14px] text-text outline-none focus-glow"
            placeholder={t("arrangements.fieldLocationPlaceholder")}
          />
        </ArrangementField>
        <ArrangementField label={t("arrangements.fieldParticipants")}>
          <input
            value={draft.participantsText}
            onChange={(event) => updateDraft("participantsText", event.target.value)}
            className="h-11 w-full rounded-[12px] bg-bg px-3 text-[14px] text-text outline-none focus-glow"
            placeholder={t("arrangements.fieldParticipantsPlaceholder")}
          />
        </ArrangementField>
        <ArrangementField label={t("arrangements.fieldReminder")}>
          <input
            value={draft.reminderText}
            onChange={(event) => updateDraft("reminderText", event.target.value)}
            className="h-11 w-full rounded-[12px] bg-bg px-3 text-[14px] text-text outline-none focus-glow"
            placeholder={t("arrangements.fieldReminderPlaceholder")}
          />
          <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
            {t("arrangements.reminderNote")}
          </p>
        </ArrangementField>
      </div>
    </SheetFrame>
  );
}

function ArrangementField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-[13px] font-medium leading-5 text-text">
        {label}
      </span>
      {children}
    </label>
  );
}

function ArrangementDetailSheet({
  arrangement,
  resolvedLocale,
  onClose,
  onEdit,
  onComplete,
  onLater,
  onRestore,
  onDelete,
}: {
  arrangement: ArrangementItem;
  resolvedLocale: string;
  onClose: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onLater: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const { t } = usePreferences();
  const sourceLabel = getSourceLabel(arrangement.sourceType, t);
  const contextText =
    arrangement.contextRefs[0]?.text ?? t("arrangements.manualContext");

  return (
    <SheetFrame onClose={onClose}>
      <div className="max-h-[78vh] overflow-y-auto px-4 pb-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-medium leading-4 text-primary">
              {getStatusLabel(arrangement.status, t)}
            </span>
            <h2 className="mt-3 text-[22px] font-semibold leading-7 text-text">
              {arrangement.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-text-muted transition active:scale-[0.96]"
            aria-label={t("common.done")}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {arrangement.description && (
          <p className="mt-3 rounded-[12px] bg-bg px-3 py-2 text-[13px] leading-5 text-text-muted">
            {arrangement.description}
          </p>
        )}

        <div className="mt-4 space-y-2">
          <DetailRow
            label={t("arrangements.detailTime")}
            value={formatArrangementTime(arrangement, resolvedLocale, t)}
          />
          <DetailRow
            label={t("arrangements.detailLocation")}
            value={arrangement.location ?? t("arrangements.none")}
          />
          <DetailRow
            label={t("arrangements.detailParticipants")}
            value={
              arrangement.participants.map((participant) => participant.name).join("、") ||
              t("arrangements.none")
            }
          />
          <DetailRow
            label={t("arrangements.detailReminder")}
            value={
              arrangement.reminders.map((reminder) => reminder.text).join("、") ||
              t("arrangements.reminderDisplayOnly")
            }
          />
          <DetailRow label={t("arrangements.detailSource")} value={sourceLabel} />
        </div>

        <section className="mt-4 rounded-[14px] border border-border-light bg-bg px-3 py-3">
          <h3 className="text-[13px] font-semibold leading-5 text-text">
            {t("arrangements.contextTitle")}
          </h3>
          <p className="mt-1 text-[12px] leading-5 text-text-muted">{contextText}</p>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {arrangement.status !== "completed" && (
            <ActionButton label={t("arrangements.actionComplete")} onClick={onComplete} primary />
          )}
          {arrangement.status !== "later" && (
            <ActionButton label={t("arrangements.actionLater")} onClick={onLater} />
          )}
          {(arrangement.status === "later" || arrangement.status === "completed") && (
            <ActionButton label={t("arrangements.actionRestore")} onClick={onRestore} />
          )}
          <ActionButton label={t("arrangements.actionEdit")} onClick={onEdit} />
          <ActionButton label={t("arrangements.actionDelete")} onClick={onDelete} />
        </div>
      </div>
    </SheetFrame>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[42px] items-center justify-between gap-4 rounded-[12px] bg-surface-muted px-3 py-2">
      <span className="shrink-0 text-[12px] leading-4 text-text-tertiary">{label}</span>
      <span className="min-w-0 text-right text-[13px] leading-5 text-text">{value}</span>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  primary,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-[42px] rounded-[12px] px-3 text-[14px] font-medium leading-5 transition active:scale-[0.98]",
        primary ? "bg-primary text-on-primary" : "bg-bg text-text"
      )}
    >
      {label}
    </button>
  );
}

function SheetFrame({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay-light"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative overflow-hidden rounded-t-[24px] bg-surface shadow-[0_-18px_46px_rgba(0,0,0,0.16)]">
        {children}
      </div>
    </div>
  );
}

function getArrangementGroups(
  arrangements: ArrangementItem[],
  t: ReturnType<typeof usePreferences>["t"]
): ArrangementGroup[] {
  const sortedArrangements = [...arrangements].sort((left, right) => {
    const leftTime = left.time.startAt ?? Number.MAX_SAFE_INTEGER;
    const rightTime = right.time.startAt ?? Number.MAX_SAFE_INTEGER;
    if (left.status === "later" && right.status !== "later") return 1;
    if (left.status !== "later" && right.status === "later") return -1;
    return leftTime - rightTime;
  });

  return [
    {
      key: "today",
      title: t("arrangements.groupToday"),
      description: t("arrangements.groupTodayDesc"),
      items: sortedArrangements.filter(
        (arrangement) =>
          arrangement.status !== "later" &&
          arrangement.status !== "settled" &&
          isArrangementToday(arrangement)
      ),
    },
    {
      key: "upcoming",
      title: t("arrangements.groupUpcoming"),
      description: t("arrangements.groupUpcomingDesc"),
      items: sortedArrangements.filter(
        (arrangement) =>
          arrangement.status !== "later" &&
          arrangement.status !== "settled" &&
          isArrangementUpcoming(arrangement)
      ),
    },
    {
      key: "no-time",
      title: t("arrangements.groupNoTime"),
      description: t("arrangements.groupNoTimeDesc"),
      items: sortedArrangements.filter(
        (arrangement) =>
          arrangement.status !== "later" &&
          arrangement.status !== "settled" &&
          arrangement.time.startAt === undefined
      ),
    },
    {
      key: "later",
      title: t("arrangements.groupLater"),
      description: t("arrangements.groupLaterDesc"),
      items: sortedArrangements.filter((arrangement) => arrangement.status === "later"),
    },
  ];
}

function formatArrangementTime(
  arrangement: ArrangementItem,
  resolvedLocale: string,
  t: ReturnType<typeof usePreferences>["t"]
) {
  if (arrangement.time.startAt !== undefined) {
    const dateText = new Intl.DateTimeFormat(resolvedLocale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(arrangement.time.startAt));
    return arrangement.time.originalText ? `${arrangement.time.originalText} · ${dateText}` : dateText;
  }
  return arrangement.time.originalText ?? t("arrangements.noTime");
}

function getStatusLabel(
  status: ArrangementStatus,
  t: ReturnType<typeof usePreferences>["t"]
) {
  if (status === "completed") return t("arrangements.statusCompleted");
  if (status === "in_progress") return t("arrangements.statusInProgress");
  if (status === "later") return t("arrangements.statusLater");
  if (status === "settled") return t("arrangements.statusSettled");
  return t("arrangements.statusPending");
}

function getTimeKindLabel(
  kind: ArrangementTimeKind,
  t: ReturnType<typeof usePreferences>["t"]
) {
  if (kind === "deadline") return t("arrangements.timeDeadline");
  if (kind === "time_range") return t("arrangements.timeRange");
  if (kind === "recurring") return t("arrangements.timeRecurring");
  if (kind === "none") return t("arrangements.timeNone");
  return t("arrangements.timeFuzzy");
}

function getSourceLabel(
  sourceType: ArrangementItem["sourceType"],
  t: ReturnType<typeof usePreferences>["t"]
) {
  if (sourceType === "self") return t("arrangements.sourceSelf");
  if (sourceType === "private_chat") return t("arrangements.sourcePrivate");
  if (sourceType === "group_chat") return t("arrangements.sourceGroup");
  if (sourceType === "ai_update") return t("arrangements.sourceAi");
  return t("arrangements.sourceManual");
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 4.5v11M4.5 10h11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3.5v3M17 3.5v3M4.75 9.25h14.5M6.5 5.25h11A2.75 2.75 0 0 1 20.25 8v9.5a2.75 2.75 0 0 1-2.75 2.75h-11a2.75 2.75 0 0 1-2.75-2.75V8A2.75 2.75 0 0 1 6.5 5.25Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m5 5 10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
