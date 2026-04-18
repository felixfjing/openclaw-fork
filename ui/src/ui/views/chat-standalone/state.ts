import { DeletedMessages } from "../../chat-claw/deleted-messages.ts";
import { InputHistory } from "../../chat-claw/input-history.ts";
import { PinnedMessages } from "../../chat-claw/pinned-messages.ts";
import { getOrCreateSessionCacheValue } from "../../chat-claw/session-cache.ts";
import type { SlashCommandDef } from "../../chat-claw/slash-commands.ts";
import { stopStt } from "../../chat-claw/speech.ts";

export interface ChatEphemeralState {
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
}

function createChatEphemeralState(): ChatEphemeralState {
  return {
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

export function resetChatViewState(): void {
  if (chatViewState.sttRecording) {
    stopStt();
  }
  Object.assign(chatViewState, createChatEphemeralState());
  emptyStateCronLoadRequestedBySession.clear();
}

export const cleanupChatModuleState = resetChatViewState;
