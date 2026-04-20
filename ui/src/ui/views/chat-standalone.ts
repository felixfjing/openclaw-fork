import { html, nothing, type TemplateResult } from "lit";
import { ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { CHAT_ATTACHMENT_ACCEPT } from "../chat-claw/attachment-support.ts";
import {
  renderMessageGroup,
  renderReadingIndicatorGroup,
  renderStreamingGroup,
} from "../chat-claw/grouped-render.ts";
import { isSttSupported, startStt, stopStt } from "../chat-claw/speech.ts";
import { buildSidebarContent } from "../chat-claw/tool-cards.ts";
import { refreshSlashCommands } from "../chat-claw/slash-commands.ts";
import { icons } from "../icons.ts";
import { detectTextDirection } from "../text-direction.ts";
import type { GatewaySessionRow } from "../types.ts";
import type { ChatItem, MessageGroup } from "../types/chat-types.ts";
import { resolveAgentAvatarUrl } from "./agents-utils.ts";
import { renderEmptyState } from "./chat-standalone/empty-state.ts";
import { renderCronPage } from "./chat-standalone/cron-page.ts";
import { renderCronCreatePage, validateCronForm, type CronCreateErrors } from "./chat-standalone/cron-create.ts";
import { renderSkillsPage } from "./chat-standalone/skills-page.ts";
import {
  adjustTextareaHeight,
  createChatInputHandler,
  createChatKeyDownHandler,
  exportMarkdown,
  handleDrop,
  handleFileSelect,
  handlePaste,
  tokenEstimate,
} from "./chat-standalone/interaction.ts";
import { buildChatItems, syncToolCardExpansionState } from "./chat-standalone/items.ts";
import { renderLoadingState } from "./chat-standalone/loading.ts";
import {
  renderAttachmentPreview,
  renderCompactionIndicator,
  renderContextNotice,
  renderFallbackIndicator,
  renderPinnedSection,
  renderSearchBar,
  renderSideResult,
  renderSessionSidebarView,
  renderSlashMenu,
} from "./chat-standalone/renderers.ts";
import {
  chatViewState,
  clearEmptyStateCronLoadRequested,
  getDeletedMessages,
  getExpandedToolCards,
  getInputHistory,
  getPinnedMessages,
  hasEmptyStateCronLoadRequested,
  loadSkillsList,
  markEmptyStateCronLoadRequested,
  resetChatViewState as resetChatViewStateImpl,
  cleanupChatModuleState as cleanupChatModuleStateImpl,
} from "./chat-standalone/state.ts";
import type { CronCreateForm } from "./chat-standalone/state.ts";
import type { ChatProps } from "./chat-standalone/types.ts";
import { renderMarkdownSidebar } from "./markdown-sidebar.ts";
import "../../styles/chat-standalone.css";
import "../components/resizable-divider.ts";

export type { ChatProps } from "./chat-standalone/types.ts";
export const resetChatViewState = resetChatViewStateImpl;
export const cleanupChatModuleState = cleanupChatModuleStateImpl;

function handleCodeBlockCopy(e: Event): void {
  const btn = (e.target as HTMLElement).closest(".code-block-copy");
  if (!btn) {
    return;
  }
  const code = (btn as HTMLElement).dataset.code ?? "";
  navigator.clipboard.writeText(code).then(
    () => {
      btn.classList.add("copied");
      setTimeout(() => btn.classList.remove("copied"), 1500);
    },
    () => {},
  );
}

function renderModelSelect(props: ChatProps): TemplateResult | typeof nothing {
  const modelSelectState = props.modelSelectState;
  if (!modelSelectState || !props.onModelChange) {
    return nothing;
  }

  const selectedOption = modelSelectState.options.find(
    (entry) => entry.value === modelSelectState.currentOverride,
  );
  const selectedLabel =
    modelSelectState.currentOverride === ""
      ? modelSelectState.defaultLabel
      : (selectedOption?.label ?? modelSelectState.currentOverride);

  return html`
    <label class="agent-chat__model-chip" title=${selectedLabel}>
      <span class="agent-chat__model-chip-icon"></span>
      <span class="agent-chat__model-chip-name">${selectedLabel}</span>
      <span class="agent-chat__model-chip-arrow">${icons.caretDownFill}</span>
      <select
        data-chat-model-select="true"
        aria-label="Select model"
        ?disabled=${!props.connected}
        @change=${(e: Event) => props.onModelChange?.((e.target as HTMLSelectElement).value)}
      >
        <option value="" ?selected=${modelSelectState.currentOverride === ""}>
          ${modelSelectState.defaultLabel}
        </option>
        ${repeat(
          modelSelectState.options,
          (option) => option.value,
          (option) => html`
            <option
              value=${option.value}
              ?selected=${option.value === modelSelectState.currentOverride}
            >
              ${option.label}
            </option>
          `,
        )}
      </select>
    </label>
  `;
}

function renderSkillsDropdown(
  props: ChatProps,
  requestUpdate: () => void,
): TemplateResult {
  const query = chatViewState.skillsSearchQuery.toLowerCase();
  const filtered = query
    ? chatViewState.skillsList.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.skillKey.toLowerCase().includes(query),
      )
    : chatViewState.skillsList;

  return html`
    <div class="agent-chat__skills-dropdown-backdrop" @click=${() => {
      chatViewState.skillsDropdownOpen = false;
      chatViewState.skillsSearchQuery = "";
      requestUpdate();
    }}></div>
    <div class="agent-chat__skills-dropdown">
      <input
        class="agent-chat__skills-dropdown-search"
        type="text"
        placeholder="搜索技能..."
        .value=${chatViewState.skillsSearchQuery}
        @input=${(e: Event) => {
          chatViewState.skillsSearchQuery = (e.target as HTMLInputElement).value;
          requestUpdate();
        }}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Escape") {
            chatViewState.skillsDropdownOpen = false;
            chatViewState.skillsSearchQuery = "";
            requestUpdate();
          }
        }}
      />
      <div class="agent-chat__skills-dropdown-list">
        ${filtered.length === 0
          ? html`<div class="agent-chat__skills-dropdown-empty">暂无可用技能</div>`
          : repeat(
              filtered,
              (s) => s.skillKey,
              (s) => html`
                <div
                  class="agent-chat__skills-dropdown-item"
                  title=${s.description}
                  @click=${() => {
                    props.onDraftChange(`/skill ${s.skillKey} ${props.draft}`);
                    chatViewState.skillsDropdownOpen = false;
                    chatViewState.skillsSearchQuery = "";
                    requestUpdate();
                  }}
                >
                  ${s.emoji ? html`<span class="agent-chat__skills-dropdown-emoji">${s.emoji}</span>` : nothing}
                  <span class="agent-chat__skills-dropdown-name">${s.name}</span>
                </div>
              `,
              )}
        </div>
      </div>
    </div>
  `;
}

function renderChatThread(
  props: ChatProps,
  chatItems: Array<ChatItem | MessageGroup>,
  assistantIdentity: { name: string; avatar: string | null },
  activeSession: GatewaySessionRow | undefined,
  deleted: {
    has(key: string): boolean;
    delete(key: string): void;
  },
  expandedToolCards: Map<string, boolean>,
  showReasoning: boolean,
  requestUpdate: () => void,
): TemplateResult {
  const isEmpty = chatItems.length === 0 && !props.loading;
  const shouldShowEmptyState = isEmpty && !chatViewState.searchOpen;
  if (shouldShowEmptyState) {
    if (props.loadCron && !hasEmptyStateCronLoadRequested(props.sessionKey)) {
      markEmptyStateCronLoadRequested(props.sessionKey);
      void props.loadCron();
    }
  } else {
    clearEmptyStateCronLoadRequested(props.sessionKey);
  }
  return html`
    <div
      class="chat-thread"
      role="log"
      aria-live="polite"
      @scroll=${props.onChatScroll}
      @click=${handleCodeBlockCopy}
    >
      <div class="chat-thread-inner">
        ${props.loading ? renderLoadingState() : nothing}
        ${shouldShowEmptyState ? renderEmptyState(props) : nothing}
        ${isEmpty && chatViewState.searchOpen
          ? html` <div class="agent-chat__empty">No matching messages</div> `
          : nothing}
        ${repeat(
          chatItems,
          (item) => item.key,
          (item) => {
            if (item.kind === "divider") {
              return html`
                <div class="chat-divider" role="separator" data-ts=${String(item.timestamp)}>
                  <span class="chat-divider__line"></span>
                  <span class="chat-divider__label">${item.label}</span>
                  <span class="chat-divider__line"></span>
                </div>
              `;
            }
            if (item.kind === "reading-indicator") {
              return renderReadingIndicatorGroup(assistantIdentity, props.basePath);
            }
            if (item.kind === "stream") {
              return renderStreamingGroup(
                item.text,
                item.startedAt,
                props.onOpenSidebar,
                assistantIdentity,
                props.basePath,
              );
            }
            if (item.kind === "group") {
              if (deleted.has(item.key)) {
                return nothing;
              }
              return renderMessageGroup(item, {
                onOpenSidebar: props.onOpenSidebar,
                showReasoning,
                showToolCalls: props.showToolCalls,
                autoExpandToolCalls: Boolean(props.autoExpandToolCalls),
                isToolMessageExpanded: (messageId: string) =>
                  expandedToolCards.get(messageId) ?? false,
                onToggleToolMessageExpanded: (messageId: string) => {
                  expandedToolCards.set(messageId, !expandedToolCards.get(messageId));
                  requestUpdate();
                },
                isToolExpanded: (toolCardId: string) => expandedToolCards.get(toolCardId) ?? false,
                onToggleToolExpanded: (toolCardId: string) => {
                  expandedToolCards.set(toolCardId, !expandedToolCards.get(toolCardId));
                  requestUpdate();
                },
                onRequestUpdate: requestUpdate,
                assistantName: props.assistantName,
                assistantAvatar: assistantIdentity.avatar,
                basePath: props.basePath,
                localMediaPreviewRoots: props.localMediaPreviewRoots ?? [],
                assistantAttachmentAuthToken: props.assistantAttachmentAuthToken ?? null,
                canvasHostUrl: props.canvasHostUrl,
                embedSandboxMode: props.embedSandboxMode ?? "scripts",
                allowExternalEmbedUrls: props.allowExternalEmbedUrls ?? false,
                contextWindow:
                  activeSession?.contextTokens ?? props.sessions?.defaults?.contextTokens ?? null,
                onDelete: () => {
                  deleted.delete(item.key);
                  requestUpdate();
                },
              });
            }
            return nothing;
          },
        )}
      </div>
    </div>
  `;
}

const weekDayToCron: Record<string, string> = {
  "周一": "1", "周二": "2", "周三": "3", "周四": "4",
  "周五": "5", "周六": "6", "周日": "0",
};

function buildCronExpr(form: CronCreateForm): string {
  const h = form.hour || "00";
  const m = form.minute || "00";
  switch (form.cycleType) {
    case "daily": return `${m} ${h} * * *`;
    case "tradingDay": return `${m} ${h} * * 1-5`;
    case "weekly": return `${m} ${h} * * ${weekDayToCron[form.weekDay] ?? "*"}`;
    case "monthly": return `${m} ${h} ${form.monthDay || "*"} * *`;
    default: return `${m} ${h} * * *`;
  }
}

let hashListenerRegistered = false;
let hashChangeCallback: (() => void) | null = null;

function isCronRoute(): boolean {
  const hash = window.location.hash;
  return hash === "#cron" || hash === "#cron/create" || hash.startsWith("#cron/edit/");
}

function isSkillsRoute(): boolean {
  return window.location.hash === "#skills";
}

function isCronCreateRoute(): boolean {
  return window.location.hash === "#cron/create";
}

function isCronEditRoute(): boolean {
  return window.location.hash.startsWith("#cron/edit/");
}

function parseCronEditJobId(): string | null {
  const match = window.location.hash.match(/^#cron\/edit\/(.+)$/);
  return match ? match[1] : null;
}

function parseCronExprToForm(expr: string): Partial<CronCreateForm> {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return {};
  const minute = parts[0];
  const hour = parts[1];
  const dayOfMonth = parts[2];
  const month = parts[3];
  const dayOfWeek = parts[4];
  const result: Partial<CronCreateForm> = { hour, minute };
  if (dayOfMonth === "*" && dayOfWeek === "*") {
    result.cycleType = "daily";
  } else if (dayOfWeek === "1-5") {
    result.cycleType = "tradingDay";
  } else if (dayOfMonth === "*") {
    result.cycleType = "weekly";
    const weekMap: Record<string, string> = { "1": "周一", "2": "周二", "3": "周三", "4": "周四", "5": "周五", "6": "周六", "0": "周日", "7": "周日" };
    result.weekDay = weekMap[dayOfWeek] ?? "";
  } else {
    result.cycleType = "monthly";
    result.monthDay = dayOfMonth;
  }
  return result;
}

export function renderChatStandalone(props: ChatProps) {
  const requestUpdate = props.onRequestUpdate ?? (() => {});

  hashChangeCallback = requestUpdate;
  if (!hashListenerRegistered) {
    window.addEventListener("hashchange", () => hashChangeCallback?.());
    hashListenerRegistered = true;
  }

  if (isSkillsRoute()) {
    if (!chatViewState.skillsListLoaded && props.connected && props.client) {
      void loadSkillsList(props.client).then(() => requestUpdate());
    }
    return html`
      <div class="chat-standalone__shell" style="grid-template-columns: 1fr">
        ${renderSkillsPage(props, requestUpdate)}
      </div>
    `;
  }

  if (isCronRoute()) {
    const onFormChange = (field: keyof CronCreateForm, value: string) => {
      chatViewState.cronCreateForm = { ...chatViewState.cronCreateForm, [field]: value };
      chatViewState.cronCreateErrors = {};
      requestUpdate();
    };

    if (isCronCreateRoute() || isCronEditRoute()) {
      // 编辑模式：从 job 数据填充表单
      if (isCronEditRoute()) {
        const editJobId = parseCronEditJobId();
        if (editJobId && editJobId !== chatViewState.cronEditJobId) {
          const job = (props.cronJobs ?? []).find((j) => j.id === editJobId);
          if (job) {
            chatViewState.cronEditJobId = editJobId;
            const scheduleForm = job.schedule.kind === "cron"
              ? parseCronExprToForm(job.schedule.expr)
              : { hour: "08", minute: "00", cycleType: "daily" as const };
            const prompt = job.payload.kind === "agentTurn" ? job.payload.message : (job.payload.kind === "systemEvent" ? (job.payload.text ?? "") : "");
            const model = job.payload.kind === "agentTurn" ? (job.payload.model ?? "") : "";
            chatViewState.cronCreateForm = {
              taskName: job.name,
              workspace: "",
              prompt,
              model,
              cycleType: scheduleForm.cycleType ?? "daily",
              weekDay: scheduleForm.weekDay ?? "",
              monthDay: scheduleForm.monthDay ?? "",
              hour: scheduleForm.hour ?? "08",
              minute: scheduleForm.minute ?? "00",
            };
            chatViewState.cronCreateErrors = null;
          }
        }
      } else {
        // 新建模式：重置编辑状态
        chatViewState.cronEditJobId = null;
      }

      const isEdit = chatViewState.cronEditJobId !== null;

      const onSave = async () => {
        const errors = validateCronForm(chatViewState.cronCreateForm);
        if (Object.keys(errors).length > 0) {
          chatViewState.cronCreateErrors = errors;
          requestUpdate();
          return;
        }
        chatViewState.cronCreateErrors = {};
        const form = chatViewState.cronCreateForm;
        const cronExpr = buildCronExpr(form);
        const hasPrompt = form.prompt.trim().length > 0;
        const payload: Record<string, unknown> = hasPrompt
          ? { kind: "agentTurn", message: form.prompt, ...(form.model ? { model: form.model } : {}) }
          : { kind: "systemEvent", text: form.taskName };
        const sessionTarget = hasPrompt ? "isolated" : "main";
        try {
          if (props.client) {
            if (isEdit) {
              await props.client.request("cron.update", {
                id: chatViewState.cronEditJobId,
                patch: {
                  name: form.taskName,
                  schedule: { kind: "cron", expr: cronExpr },
                  sessionTarget,
                  payload,
                },
              });
            } else {
              await props.client.request("cron.add", {
                name: form.taskName,
                enabled: true,
                schedule: { kind: "cron", expr: cronExpr },
                sessionTarget,
                wakeMode: "next-heartbeat",
                payload,
              });
            }
          }
          if (props.loadCron) {
            await props.loadCron();
          }
        } catch (err) {
          chatViewState.cronCreateErrors = {
            taskName: `${isEdit ? "保存" : "创建"}失败: ${err instanceof Error ? err.message : "未知错误"}`,
          };
          requestUpdate();
          return;
        }
        window.location.hash = "#cron";
      };

      return html`
        <div class="chat-standalone__shell" style="grid-template-columns: 1fr">
          ${renderCronPage(
            props,
            { cronFilter: chatViewState.cronFilter, cronSearch: chatViewState.cronSearch },
            (filter) => { chatViewState.cronFilter = filter; requestUpdate(); },
            (query) => { chatViewState.cronSearch = query; requestUpdate(); },
          )}
          ${renderCronCreatePage(
            props,
            chatViewState.cronCreateForm,
            chatViewState.cronCreateErrors ?? {},
            onFormChange,
            onSave,
          )}
        </div>
      `;
    }
    // cron 列表页：确保数据已加载
    if (props.loadCron && !hasEmptyStateCronLoadRequested(props.sessionKey)) {
      markEmptyStateCronLoadRequested(props.sessionKey);
      props.loadCron()
        .then(() => requestUpdate())
        .catch(() => requestUpdate());
    }
    return html`
      <div class="chat-standalone__shell" style="grid-template-columns: 1fr">
        ${renderCronPage(
          props,
          { cronFilter: chatViewState.cronFilter, cronSearch: chatViewState.cronSearch },
          (filter) => { chatViewState.cronFilter = filter; requestUpdate(); },
          (query) => { chatViewState.cronSearch = query; requestUpdate(); },
        )}
      </div>
    `;
  }

  const canCompose = props.connected;
  const isBusy = props.sending || props.stream !== null;
  const canAbort = Boolean(props.canAbort && props.onAbort);
  const activeSession = props.sessions?.sessions?.find((row) => row.key === props.sessionKey);
  const reasoningLevel = activeSession?.reasoningLevel ?? "off";
  const showReasoning = props.showThinking && reasoningLevel !== "off";
  const assistantIdentity = {
    name: props.assistantName,
    avatar:
      resolveAgentAvatarUrl({
        identity: {
          avatar: props.assistantAvatar ?? undefined,
          avatarUrl: props.assistantAvatarUrl ?? undefined,
        },
      }) ?? null,
  };
  const pinned = getPinnedMessages(props.sessionKey);
  const deleted = getDeletedMessages(props.sessionKey);
  const inputHistory = getInputHistory(props.sessionKey);
  const tokens = tokenEstimate(props.draft);

  if (!chatViewState.skillsListLoaded && props.connected && props.client) {
    void loadSkillsList(props.client).then(() => requestUpdate());
    void refreshSlashCommands({ client: props.client, agentId: props.currentAgentId }).then(() => requestUpdate());
  }

  const placeholder = props.connected
    ? "可以拖拽上传图片、文档等附件，@快速引用文件，“/”快速引用技能"
    : "Connect to the gateway to start chatting...";

  const getDraft = props.getDraft ?? (() => props.draft);
  const splitRatio = props.splitRatio ?? 0.6;
  const sidebarOpen = Boolean(props.sidebarOpen && props.onCloseSidebar);
  const sessionSidebar = renderSessionSidebarView(props, requestUpdate);

  const chatItems = buildChatItems(props);
  syncToolCardExpansionState(props.sessionKey, chatItems, Boolean(props.autoExpandToolCalls));
  const expandedToolCards = getExpandedToolCards(props.sessionKey);

  const thread = renderChatThread(
    props,
    chatItems,
    assistantIdentity,
    activeSession,
    deleted,
    expandedToolCards,
    showReasoning,
    requestUpdate,
  );

  const handleKeyDown = createChatKeyDownHandler({
    props,
    requestUpdate,
    inputHistory,
    canCompose,
  });
  const handleInput = createChatInputHandler({
    props,
    requestUpdate,
    inputHistory,
  });

  return html`
    <div class="chat-standalone__shell">
      ${sessionSidebar}

      <section
        class="card chat chat--standalone"
        @drop=${(e: DragEvent) => handleDrop(e, props)}
        @dragover=${(e: DragEvent) => e.preventDefault()}
      >
        ${props.disabledReason ? html`<div class="callout">${props.disabledReason}</div>` : nothing}
        ${props.error ? html`<div class="callout danger">${props.error}</div>` : nothing}
        <div class="chat-standalone__content">
          ${renderSearchBar(requestUpdate)} ${renderPinnedSection(props, pinned, requestUpdate)}

          <div class="chat-split-container ${sidebarOpen ? "chat-split-container--open" : ""}">
            <div
              class="chat-main"
              style="flex: ${sidebarOpen ? `0 0 ${splitRatio * 100}%` : "1 1 100%"}"
            >
              ${thread}
            </div>

            ${sidebarOpen
              ? html`
                  <resizable-divider
                    .splitRatio=${splitRatio}
                    @resize=${(e: CustomEvent) => props.onSplitRatioChange?.(e.detail.splitRatio)}
                  ></resizable-divider>
                  <div class="chat-sidebar">
                    ${renderMarkdownSidebar({
                      content: props.sidebarContent ?? null,
                      error: props.sidebarError ?? null,
                      canvasHostUrl: props.canvasHostUrl,
                      embedSandboxMode: props.embedSandboxMode ?? "scripts",
                      allowExternalEmbedUrls: props.allowExternalEmbedUrls ?? false,
                      onClose: props.onCloseSidebar!,
                      onViewRawText: () => {
                        if (!props.sidebarContent || !props.onOpenSidebar) {
                          return;
                        }
                        if (props.sidebarContent.kind === "markdown") {
                          props.onOpenSidebar(
                            buildSidebarContent(`\`\`\`\n${props.sidebarContent.content}\n\`\`\``),
                          );
                          return;
                        }
                        if (props.sidebarContent.rawText?.trim()) {
                          props.onOpenSidebar(
                            buildSidebarContent(
                              `\`\`\`json\n${props.sidebarContent.rawText}\n\`\`\``,
                            ),
                          );
                        }
                      },
                    })}
                  </div>
                `
              : nothing}
          </div>
        </div>

        ${props.queue.length
          ? html`
              <div class="chat-queue" role="status" aria-live="polite">
                <div class="chat-queue__title">Queued (${props.queue.length})</div>
                <div class="chat-queue__list">
                  ${props.queue.map(
                    (item) => html`
                      <div class="chat-queue__item">
                        <div class="chat-queue__text">
                          ${item.text ||
                          (item.attachments?.length ? `Image (${item.attachments.length})` : "")}
                        </div>
                        <button
                          class="btn chat-queue__remove"
                          type="button"
                          aria-label="Remove queued message"
                          @click=${() => props.onQueueRemove(item.id)}
                        >
                          ${icons.x}
                        </button>
                      </div>
                    `,
                  )}
                </div>
              </div>
            `
          : nothing}
        ${renderSideResult(props.sideResult, props.onDismissSideResult)}
        ${renderFallbackIndicator(props.fallbackStatus)}
        ${renderCompactionIndicator(props.compactionStatus)}
        ${renderContextNotice(activeSession, props.sessions?.defaults?.contextTokens ?? null)}
        ${props.showNewMessages
          ? html`
              <button class="chat-new-messages" type="button" @click=${props.onScrollToBottom}>
                ${icons.arrowDown} New messages
              </button>
            `
          : nothing}

        <div class="agent-chat__input">
          ${renderSlashMenu(requestUpdate, props)} ${renderAttachmentPreview(props)}

          <input
            type="file"
            accept=${CHAT_ATTACHMENT_ACCEPT}
            multiple
            class="agent-chat__file-input"
            @change=${(e: Event) => handleFileSelect(e, props)}
          />

          ${chatViewState.sttRecording && chatViewState.sttInterimText
            ? html`<div class="agent-chat__stt-interim">${chatViewState.sttInterimText}</div>`
            : nothing}

          <div class="agent-chat__composer">
            <textarea
              ${ref((el) => el && adjustTextareaHeight(el as HTMLTextAreaElement))}
              .value=${props.draft}
              dir=${detectTextDirection(props.draft)}
              ?disabled=${!props.connected}
              @keydown=${handleKeyDown}
              @input=${handleInput}
              @paste=${(e: ClipboardEvent) => handlePaste(e, props)}
              placeholder=${chatViewState.sttRecording ? "Listening..." : placeholder}
              rows="1"
            ></textarea>

            <div class="agent-chat__toolbar">
              <div class="agent-chat__toolbar-left">
                ${renderModelSelect(props)}
                <span class="agent-chat__toolbar-divider">${icons.dividerV}</span>
                <button
                  class="agent-chat__toolbar-chip ${chatViewState.skillsDropdownOpen ? 'active' : ''}"
                  title="技能"
                  aria-label="Skills"
                  ?disabled=${!props.connected}
                  @click=${() => {
                    chatViewState.skillsDropdownOpen = !chatViewState.skillsDropdownOpen;
                    chatViewState.skillsSearchQuery = "";
                    requestUpdate();
                  }}
                >
                  ${icons.wrench}
                  <span class="agent-chat__toolbar-chip-label">技能</span>
                  ${icons.caretDownFill}
                </button>
                ${chatViewState.skillsDropdownOpen ? renderSkillsDropdown(props, requestUpdate) : nothing}
                <span class="agent-chat__toolbar-divider">${icons.dividerV}</span>
                <button
                  class="agent-chat__toolbar-chip"
                  title="专家"
                  aria-label="Expert"
                  ?disabled=${!props.connected}
                >
                  ${icons.graduationCap}
                  <span class="agent-chat__toolbar-chip-label">专家</span>
                  ${icons.caretDownFill}
                </button>
              </div>

              <div class="agent-chat__toolbar-right">
                <button
                  class="agent-chat__input-btn"
                  @click=${() => {
                    document.querySelector<HTMLInputElement>(".agent-chat__file-input")?.click();
                  }}
                  title="Attach file"
                  aria-label="Attach file"
                  ?disabled=${!props.connected}
                >
                  ${icons.paperclip}
                </button>
                ${canAbort
                  ? html`
                      <button
                        class="chat-send-btn chat-send-btn--stop"
                        @click=${props.onAbort}
                        title="Stop"
                        aria-label="Stop generating"
                      >
                        ${icons.stop}
                      </button>
                    `
                  : html`
                      <button
                        class="chat-send-btn"
                        @click=${() => {
                          if (props.draft.trim()) {
                            inputHistory.push(props.draft);
                          }
                          props.onSend();
                        }}
                        ?disabled=${!props.connected || props.sending}
                        title=${isBusy ? "Queue" : "Send"}
                        aria-label=${isBusy ? "Queue message" : "Send message"}
                      >
                        ${icons.send}
                      </button>
                    `}
              </div>
            </div>
          </div>
        </div>
        <p class="agent-chat__disclaimer">
          <span>以上内容由 AI 生成，不构成任何投资建议</span>
        </p>
      </section>
    </div>
  `;
}
