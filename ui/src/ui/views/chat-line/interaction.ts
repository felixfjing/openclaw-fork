import { isSupportedChatAttachmentMimeType } from "../../chat-claw/attachment-support.ts";
import { exportChatMarkdown } from "../../chat-claw/export.ts";
import { InputHistory } from "../../chat-claw/input-history.ts";
import {
  SLASH_COMMANDS,
  getSlashCommandCompletions,
  type SlashCommandDef,
} from "../../chat-claw/slash-commands.ts";
import { chatViewState } from "./state.ts";
import type { ChatProps } from "./types.ts";

export function adjustTextareaHeight(el: HTMLTextAreaElement): void {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
}

export function generateAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function handlePaste(e: ClipboardEvent, props: ChatProps): void {
  const items = e.clipboardData?.items;
  if (!items || !props.onAttachmentsChange) {
    return;
  }
  const imageItems: DataTransferItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith("image/")) {
      imageItems.push(item);
    }
  }
  if (imageItems.length === 0) {
    return;
  }
  e.preventDefault();
  for (const item of imageItems) {
    const file = item.getAsFile();
    if (!file) {
      continue;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const dataUrl = reader.result as string;
      const newAttachment = {
        id: generateAttachmentId(),
        dataUrl,
        mimeType: file.type,
      };
      const current = props.attachments ?? [];
      props.onAttachmentsChange?.([...current, newAttachment]);
    });
    reader.readAsDataURL(file);
  }
}

export function handleFileSelect(e: Event, props: ChatProps): void {
  const input = e.target as HTMLInputElement;
  if (!input.files || !props.onAttachmentsChange) {
    return;
  }
  const current = props.attachments ?? [];
  const additions: Array<{ id: string; dataUrl: string; mimeType: string }> = [];
  let pending = 0;
  for (const file of input.files) {
    if (!isSupportedChatAttachmentMimeType(file.type)) {
      continue;
    }
    pending++;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      additions.push({
        id: generateAttachmentId(),
        dataUrl: reader.result as string,
        mimeType: file.type,
      });
      pending--;
      if (pending === 0) {
        props.onAttachmentsChange?.([...current, ...additions]);
      }
    });
    reader.readAsDataURL(file);
  }
  input.value = "";
}

export function handleDrop(e: DragEvent, props: ChatProps): void {
  e.preventDefault();
  const files = e.dataTransfer?.files;
  if (!files || !props.onAttachmentsChange) {
    return;
  }
  const current = props.attachments ?? [];
  const additions: Array<{ id: string; dataUrl: string; mimeType: string }> = [];
  let pending = 0;
  for (const file of files) {
    if (!isSupportedChatAttachmentMimeType(file.type)) {
      continue;
    }
    pending++;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      additions.push({
        id: generateAttachmentId(),
        dataUrl: reader.result as string,
        mimeType: file.type,
      });
      pending--;
      if (pending === 0) {
        props.onAttachmentsChange?.([...current, ...additions]);
      }
    });
    reader.readAsDataURL(file);
  }
}

export function resetSlashMenuState(): void {
  chatViewState.slashMenuMode = "command";
  chatViewState.slashMenuCommand = null;
  chatViewState.slashMenuArgItems = [];
  chatViewState.slashMenuItems = [];
}

export function updateSlashMenu(value: string, requestUpdate: () => void): void {
  const argMatch = value.match(/^\/(\S+)\s(.*)$/);
  if (argMatch) {
    const cmdName = argMatch[1].toLowerCase();
    const argFilter = argMatch[2].toLowerCase();
    const cmd = SLASH_COMMANDS.find((c) => c.name === cmdName);
    if (cmd?.argOptions?.length) {
      const filtered = argFilter
        ? cmd.argOptions.filter((opt) => opt.toLowerCase().startsWith(argFilter))
        : cmd.argOptions;
      if (filtered.length > 0) {
        chatViewState.slashMenuMode = "args";
        chatViewState.slashMenuCommand = cmd;
        chatViewState.slashMenuArgItems = filtered;
        chatViewState.slashMenuOpen = true;
        chatViewState.slashMenuIndex = 0;
        chatViewState.slashMenuItems = [];
        requestUpdate();
        return;
      }
    }
    chatViewState.slashMenuOpen = false;
    resetSlashMenuState();
    requestUpdate();
    return;
  }

  const match = value.match(/^\/(\S*)$/);
  if (match) {
    const items = getSlashCommandCompletions(match[1]);
    chatViewState.slashMenuItems = items;
    chatViewState.slashMenuOpen = items.length > 0;
    chatViewState.slashMenuIndex = 0;
    chatViewState.slashMenuMode = "command";
    chatViewState.slashMenuCommand = null;
    chatViewState.slashMenuArgItems = [];
  } else {
    chatViewState.slashMenuOpen = false;
    resetSlashMenuState();
  }
  requestUpdate();
}

export function selectSlashCommand(
  cmd: SlashCommandDef,
  props: ChatProps,
  requestUpdate: () => void,
): void {
  if (cmd.argOptions?.length) {
    props.onDraftChange(`/${cmd.name} `);
    chatViewState.slashMenuMode = "args";
    chatViewState.slashMenuCommand = cmd;
    chatViewState.slashMenuArgItems = cmd.argOptions;
    chatViewState.slashMenuOpen = true;
    chatViewState.slashMenuIndex = 0;
    chatViewState.slashMenuItems = [];
    requestUpdate();
    return;
  }

  chatViewState.slashMenuOpen = false;
  resetSlashMenuState();

  if (cmd.executeLocal && !cmd.args) {
    props.onDraftChange(`/${cmd.name}`);
    requestUpdate();
    props.onSend();
  } else {
    props.onDraftChange(`/${cmd.name} `);
    requestUpdate();
  }
}

export function tabCompleteSlashCommand(
  cmd: SlashCommandDef,
  props: ChatProps,
  requestUpdate: () => void,
): void {
  if (cmd.argOptions?.length) {
    props.onDraftChange(`/${cmd.name} `);
    chatViewState.slashMenuMode = "args";
    chatViewState.slashMenuCommand = cmd;
    chatViewState.slashMenuArgItems = cmd.argOptions;
    chatViewState.slashMenuOpen = true;
    chatViewState.slashMenuIndex = 0;
    chatViewState.slashMenuItems = [];
    requestUpdate();
    return;
  }

  chatViewState.slashMenuOpen = false;
  resetSlashMenuState();
  props.onDraftChange(cmd.args ? `/${cmd.name} ` : `/${cmd.name}`);
  requestUpdate();
}

export function selectSlashArg(
  arg: string,
  props: ChatProps,
  requestUpdate: () => void,
  execute: boolean,
): void {
  const cmdName = chatViewState.slashMenuCommand?.name ?? "";
  chatViewState.slashMenuOpen = false;
  resetSlashMenuState();
  props.onDraftChange(`/${cmdName} ${arg}`);
  requestUpdate();
  if (execute) {
    props.onSend();
  }
}

export function tokenEstimate(draft: string): string | null {
  if (draft.length < 100) {
    return null;
  }
  return `~${Math.ceil(draft.length / 4)} tokens`;
}

export function exportMarkdown(props: ChatProps): void {
  exportChatMarkdown(props.messages, props.assistantName);
}

export function createChatKeyDownHandler(args: {
  props: ChatProps;
  requestUpdate: () => void;
  inputHistory: InputHistory;
  canCompose: boolean;
  getDraft: () => string;
}): (e: KeyboardEvent) => void {
  const { props, requestUpdate, inputHistory, canCompose, getDraft } = args;
  return (e: KeyboardEvent) => {
    if (chatViewState.slashMenuOpen && chatViewState.slashMenuMode === "args" && chatViewState.slashMenuArgItems.length > 0) {
      const len = chatViewState.slashMenuArgItems.length;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          chatViewState.slashMenuIndex = (chatViewState.slashMenuIndex + 1) % len;
          requestUpdate();
          return;
        case "ArrowUp":
          e.preventDefault();
          chatViewState.slashMenuIndex = (chatViewState.slashMenuIndex - 1 + len) % len;
          requestUpdate();
          return;
        case "Tab":
          e.preventDefault();
          selectSlashArg(chatViewState.slashMenuArgItems[chatViewState.slashMenuIndex], props, requestUpdate, false);
          return;
        case "Enter":
          e.preventDefault();
          selectSlashArg(chatViewState.slashMenuArgItems[chatViewState.slashMenuIndex], props, requestUpdate, true);
          return;
        case "Escape":
          e.preventDefault();
          chatViewState.slashMenuOpen = false;
          resetSlashMenuState();
          requestUpdate();
          return;
      }
    }

    if (chatViewState.slashMenuOpen && chatViewState.slashMenuItems.length > 0) {
      const len = chatViewState.slashMenuItems.length;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          chatViewState.slashMenuIndex = (chatViewState.slashMenuIndex + 1) % len;
          requestUpdate();
          return;
        case "ArrowUp":
          e.preventDefault();
          chatViewState.slashMenuIndex = (chatViewState.slashMenuIndex - 1 + len) % len;
          requestUpdate();
          return;
        case "Tab":
          e.preventDefault();
          tabCompleteSlashCommand(chatViewState.slashMenuItems[chatViewState.slashMenuIndex], props, requestUpdate);
          return;
        case "Enter":
          e.preventDefault();
          selectSlashCommand(chatViewState.slashMenuItems[chatViewState.slashMenuIndex], props, requestUpdate);
          return;
        case "Escape":
          e.preventDefault();
          chatViewState.slashMenuOpen = false;
          resetSlashMenuState();
          requestUpdate();
          return;
      }
    }

    if (e.key === "Escape" && props.sideResult && !chatViewState.searchOpen) {
      e.preventDefault();
      props.onDismissSideResult?.();
      return;
    }

    if (!props.draft.trim()) {
      if (e.key === "ArrowUp") {
        const prev = inputHistory.up();
        if (prev !== null) {
          e.preventDefault();
          props.onDraftChange(prev);
        }
        return;
      }
      if (e.key === "ArrowDown") {
        const next = inputHistory.down();
        e.preventDefault();
        props.onDraftChange(next ?? "");
        return;
      }
    }

    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "f") {
      e.preventDefault();
      chatViewState.searchOpen = !chatViewState.searchOpen;
      if (!chatViewState.searchOpen) {
        chatViewState.searchQuery = "";
      }
      requestUpdate();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      if (e.isComposing || e.keyCode === 229) {
        return;
      }
      if (!props.connected) {
        return;
      }
      e.preventDefault();
      if (canCompose) {
        if (props.draft.trim()) {
          inputHistory.push(props.draft);
        }
        props.onSend();
      }
    }
  };
}

export function createChatInputHandler(args: {
  props: ChatProps;
  requestUpdate: () => void;
  inputHistory: InputHistory;
}): (e: Event) => void {
  const { props, requestUpdate, inputHistory } = args;
  return (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    adjustTextareaHeight(target);
    updateSlashMenu(target.value, requestUpdate);
    inputHistory.reset();
    props.onDraftChange(target.value);
  };
}
