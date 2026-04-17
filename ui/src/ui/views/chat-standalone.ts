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
import { icons } from "../icons.ts";
import { detectTextDirection } from "../text-direction.ts";
import type { GatewaySessionRow } from "../types.ts";
import type { ChatItem, MessageGroup } from "../types/chat-types.ts";
import { resolveAgentAvatarUrl } from "./agents-utils.ts";
import { renderEmptyState } from "./chat-standalone/empty-state.ts";
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
  resetChatViewState as resetChatViewStateImpl,
  markEmptyStateCronLoadRequested,
  cleanupChatModuleState as cleanupChatModuleStateImpl,
} from "./chat-standalone/state.ts";
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
    <label class="agent-chat__agent-select" title=${selectedLabel}>
      <span class="agent-chat__agent-select-label">Model</span>
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

export function renderChatStandalone(props: ChatProps) {
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

  const placeholder = props.connected
    ? "可以拖拽上传图片、文档等附件，@快速引用文件，“/”快速引用技能"
    : "Connect to the gateway to start chatting...";

  const requestUpdate = props.onRequestUpdate ?? (() => {});
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
                ${tokens ? html`<span class="agent-chat__token-count">${tokens}</span>` : nothing}
              </div>

              <div class="agent-chat__toolbar-right">
                ${nothing /* search hidden for now */}
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
                <button
                  class="btn btn--ghost"
                  @click=${() => exportMarkdown(props)}
                  title="Export"
                  aria-label="Export chat"
                  ?disabled=${props.messages.length === 0}
                >
                  ${icons.download}
                </button>

                ${isSttSupported()
                  ? html`
                      <button
                        class="agent-chat__input-btn ${chatViewState.sttRecording
                          ? "agent-chat__input-btn--recording"
                          : ""}"
                        @click=${() => {
                          if (chatViewState.sttRecording) {
                            stopStt();
                            chatViewState.sttRecording = false;
                            chatViewState.sttInterimText = "";
                            requestUpdate();
                          } else {
                            const started = startStt({
                              onTranscript: (text, isFinal) => {
                                if (isFinal) {
                                  const current = getDraft();
                                  const sep = current && !current.endsWith(" ") ? " " : "";
                                  props.onDraftChange(current + sep + text);
                                  chatViewState.sttInterimText = "";
                                } else {
                                  chatViewState.sttInterimText = text;
                                }
                                requestUpdate();
                              },
                              onStart: () => {
                                chatViewState.sttRecording = true;
                                requestUpdate();
                              },
                              onEnd: () => {
                                chatViewState.sttRecording = false;
                                chatViewState.sttInterimText = "";
                                requestUpdate();
                              },
                              onError: () => {
                                chatViewState.sttRecording = false;
                                chatViewState.sttInterimText = "";
                                requestUpdate();
                              },
                            });
                            if (started) {
                              chatViewState.sttRecording = true;
                              requestUpdate();
                            }
                          }
                        }}
                        title=${chatViewState.sttRecording ? "Stop recording" : "Voice input"}
                        ?disabled=${!props.connected}
                      >
                        ${chatViewState.sttRecording ? icons.micOff : icons.mic}
                      </button>
                    `
                  : nothing}
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
