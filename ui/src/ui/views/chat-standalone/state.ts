import { DeletedMessages } from "../../chat-claw/deleted-messages.ts";
import { InputHistory } from "../../chat-claw/input-history.ts";
import { PinnedMessages } from "../../chat-claw/pinned-messages.ts";
import { getOrCreateSessionCacheValue } from "../../chat-claw/session-cache.ts";
import type { SlashCommandDef } from "../../chat-claw/slash-commands.ts";
import { stopStt } from "../../chat-claw/speech.ts";

export interface SkillCardEntry {
  name: string;
  skillKey: string;
  emoji?: string;
  description: string;
  enabled: boolean;
  iconChar: string;
  iconColor: string;
  tags: string[];
  status: "idle" | "updating" | "update_available";
  avatarUrl?: string;
}

export interface CronCreateForm {
  taskName: string;
  workspace: string;
  prompt: string;
  model: string;
  cycleType: "daily" | "tradingDay" | "weekly" | "monthly";
  weekDay: string;
  monthDay: string;
  hour: string;
  minute: string;
}

function createDefaultCronForm(): CronCreateForm {
  return {
    taskName: "",
    workspace: "",
    prompt: "",
    model: "",
    cycleType: "daily",
    weekDay: "",
    monthDay: "",
    hour: "08",
    minute: "00",
  };
}

export interface ChatEphemeralState {
  cronSubView: boolean;
  cronFilter: "all" | "enabled" | "disabled";
  cronSearch: string;
  cronCreateForm: CronCreateForm;
  cronCreateErrors: Record<string, string> | null;
  cronEditJobId: string | null;
  sttRecording: boolean;
  sttInterimText: string;
  sessionSidebarCollapsed: boolean;
  sessionSidebarSearch: string;
  slashMenuOpen: boolean;
  slashMenuItems: SlashCommandDef[];
  slashMenuIndex: number;
  slashMenuMode: "command" | "args";
  slashMenuCommand: SlashCommandDef | null;
  slashMenuArgItems: string[];
  searchOpen: boolean;
  searchQuery: string;
  pinnedExpanded: boolean;
  skillsList: SkillCardEntry[];
  skillsListLoaded: boolean;
  skillsDropdownOpen: boolean;
  skillsSearchQuery: string;
  skillsTab: "my" | "market";
  skillsPageSearchQuery: string;
  skillsAddDropdownOpen: boolean;
}

function createChatEphemeralState(): ChatEphemeralState {
  return {
    cronSubView: false,
    cronFilter: "all",
    cronSearch: "",
    cronCreateForm: createDefaultCronForm(),
    cronCreateErrors: null,
    cronEditJobId: null,
    sttRecording: false,
    sttInterimText: "",
    sessionSidebarCollapsed: false,
    sessionSidebarSearch: "",
    slashMenuOpen: false,
    slashMenuItems: [],
    slashMenuIndex: 0,
    slashMenuMode: "command",
    slashMenuCommand: null,
    slashMenuArgItems: [],
    searchOpen: false,
    searchQuery: "",
    pinnedExpanded: false,
    skillsList: [],
    skillsListLoaded: false,
    skillsDropdownOpen: false,
    skillsSearchQuery: "",
    skillsTab: "my",
    skillsPageSearchQuery: "",
    skillsAddDropdownOpen: false,
  };
}

export const chatViewState = createChatEphemeralState();

const inputHistories = new Map<string, InputHistory>();
const pinnedMessagesMap = new Map<string, PinnedMessages>();
const deletedMessagesMap = new Map<string, DeletedMessages>();
const expandedToolCardsBySession = new Map<string, Map<string, boolean>>();
const initializedToolCardsBySession = new Map<string, Set<string>>();
const lastAutoExpandPrefBySession = new Map<string, boolean>();
const emptyStateCronLoadRequestedBySession = new Set<string>();

export function getInputHistory(sessionKey: string): InputHistory {
  return getOrCreateSessionCacheValue(inputHistories, sessionKey, () => new InputHistory());
}

export function getPinnedMessages(sessionKey: string): PinnedMessages {
  return getOrCreateSessionCacheValue(
    pinnedMessagesMap,
    sessionKey,
    () => new PinnedMessages(sessionKey),
  );
}

export function getDeletedMessages(sessionKey: string): DeletedMessages {
  return getOrCreateSessionCacheValue(
    deletedMessagesMap,
    sessionKey,
    () => new DeletedMessages(sessionKey),
  );
}

export function getExpandedToolCards(sessionKey: string): Map<string, boolean> {
  return getOrCreateSessionCacheValue(expandedToolCardsBySession, sessionKey, () => new Map());
}

export function getInitializedToolCards(sessionKey: string): Set<string> {
  return getOrCreateSessionCacheValue(initializedToolCardsBySession, sessionKey, () => new Set());
}

export function getLastAutoExpandPref(sessionKey: string): boolean {
  return lastAutoExpandPrefBySession.get(sessionKey) ?? false;
}

export function setLastAutoExpandPref(sessionKey: string, enabled: boolean): void {
  lastAutoExpandPrefBySession.set(sessionKey, enabled);
}

export function hasEmptyStateCronLoadRequested(sessionKey: string): boolean {
  return emptyStateCronLoadRequestedBySession.has(sessionKey);
}

export function markEmptyStateCronLoadRequested(sessionKey: string): void {
  emptyStateCronLoadRequestedBySession.add(sessionKey);
}

export function clearEmptyStateCronLoadRequested(sessionKey: string): void {
  emptyStateCronLoadRequestedBySession.delete(sessionKey);
}

export async function loadSkillsList(client: { request: (method: string, params: Record<string, unknown>) => Promise<unknown> }): Promise<void> {
  if (chatViewState.skillsListLoaded) return;
  try {
    const res = (await client.request("skills.status", {})) as {
      skills?: Array<{
        disabled: boolean;
        name: string;
        skillKey: string;
        emoji?: string;
        description?: string;
        iconChar?: string;
        iconColor?: string;
        tags?: string[];
        status?: string;
        avatarUrl?: string;
      }>;
    } | null;
    if (res?.skills) {
      chatViewState.skillsList = res.skills.map((s) => ({
        name: s.name,
        skillKey: s.skillKey,
        emoji: s.emoji,
        description: s.description ?? "",
        enabled: !s.disabled,
        iconChar: s.iconChar ?? s.name.charAt(0),
        iconColor: s.iconColor ?? hashSkillColor(s.skillKey),
        tags: s.tags ?? [],
        status: (s.status as "idle" | "updating" | "update_available") ?? "idle",
        avatarUrl: s.avatarUrl,
      }));
    }
  } catch {
    // 技能列表加载失败时不阻断UI
  } finally {
    chatViewState.skillsListLoaded = true;
  }
}

const SKILL_PALETTE = [
  "#d19d4e", "#f08c12", "#2a79ee", "#34c5db",
  "#616df3", "#34c5db", "#f08c12", "#d19d4e",
];

function hashSkillColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return SKILL_PALETTE[Math.abs(hash) % SKILL_PALETTE.length];
}

export function resetChatViewState(): void {
  if (chatViewState.sttRecording) {
    stopStt();
  }
  Object.assign(chatViewState, createChatEphemeralState());
  emptyStateCronLoadRequestedBySession.clear();
}

export const cleanupChatModuleState = resetChatViewState;
