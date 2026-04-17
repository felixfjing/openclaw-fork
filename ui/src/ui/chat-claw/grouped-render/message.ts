import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { icons } from "../../icons.ts";
import { toSanitizedMarkdownHtml } from "../../markdown.ts";
import { detectTextDirection } from "../../text-direction.ts";
import type {
  MessageContentItem,
  NormalizedMessage,
  ToolCard,
} from "../../types/chat-types.ts";
import type { SidebarContent } from "../../sidebar-content.ts";
import type { EmbedSandboxMode } from "../../embed-sandbox.ts";
import { renderCopyAsMarkdownButton } from "../copy-as-markdown.ts";
import {
  extractThinkingCached,
  formatReasoningMarkdown,
} from "../message-extract.ts";
import {
  isToolResultMessage,
  normalizeMessage,
  normalizeRoleForGrouping,
} from "../message-normalizer.ts";
import {
  extractImages,
  renderAssistantAttachments,
  renderMessageImages,
} from "./attachments.ts";
import {
  extractToolCards,
  renderExpandedToolCardContent,
  renderRawOutputToggle,
  renderToolCard,
  renderToolPreview,
} from "../tool-cards.ts";

function renderReplyPill(replyTarget: NormalizedMessage["replyTarget"]) {
  if (!replyTarget) {
    return nothing;
  }
  return html`
    <div class="chat-reply-pill">
      <span class="chat-reply-pill__icon">${icons.messageSquare}</span>
      <span class="chat-reply-pill__label">
        ${replyTarget.kind === "current"
          ? "Replying to current message"
          : `Replying to ${replyTarget.id}`}
      </span>
    </div>
  `;
}

/**
 * Max characters for auto-detecting and pretty-printing JSON.
 * Prevents DoS from large JSON payloads in assistant/tool messages.
 */
const MAX_JSON_AUTOPARSE_CHARS = 20_000;

function detectJson(text: string): { parsed: unknown; pretty: string } | null {
  const t = text.trim();

  if (t.length > MAX_JSON_AUTOPARSE_CHARS) {
    return null;
  }

  if (
    (t.startsWith("{") && t.endsWith("}")) ||
    (t.startsWith("[") && t.endsWith("]"))
  ) {
    try {
      const parsed = JSON.parse(t);
      return { parsed, pretty: JSON.stringify(parsed, null, 2) };
    } catch {
      return null;
    }
  }
  return null;
}

function jsonSummaryLabel(parsed: unknown): string {
  if (Array.isArray(parsed)) {
    return `Array (${parsed.length} item${parsed.length === 1 ? "" : "s"})`;
  }
  if (parsed && typeof parsed === "object") {
    const keys = Object.keys(parsed as Record<string, unknown>);
    if (keys.length <= 4) {
      return `{ ${keys.join(", ")} }`;
    }
    return `Object (${keys.length} keys)`;
  }
  return "JSON";
}

function renderExpandButton(
  markdown: string,
  onOpenSidebar: (content: SidebarContent) => void,
) {
  return html`
    <button
      class="btn btn--xs chat-expand-btn"
      type="button"
      title="Open in canvas"
      aria-label="Open in canvas"
      @click=${() => onOpenSidebar({ kind: "markdown", content: markdown })}
    >
      <span class="chat-expand-btn__icon" aria-hidden="true"
        >${icons.panelRightOpen}</span
      >
    </button>
  `;
}

function renderInlineToolCards(
  toolCards: ToolCard[],
  opts: {
    messageKey: string;
    onOpenSidebar?: (content: SidebarContent) => void;
    isToolExpanded?: (toolCardId: string) => boolean;
    onToggleToolExpanded?: (toolCardId: string) => void;
    canvasHostUrl?: string | null;
    embedSandboxMode?: EmbedSandboxMode;
    allowExternalEmbedUrls?: boolean;
  },
) {
  return html`
    <div class="chat-tools-inline">
      ${toolCards.map((card, index) =>
        renderToolCard(card, {
          expanded:
            opts.isToolExpanded?.(`${opts.messageKey}:toolcard:${index}`) ??
            false,
          onToggleExpanded: opts.onToggleToolExpanded
            ? () =>
                opts.onToggleToolExpanded?.(
                  `${opts.messageKey}:toolcard:${index}`,
                )
            : () => undefined,
          onOpenSidebar: opts.onOpenSidebar,
          canvasHostUrl: opts.canvasHostUrl,
          embedSandboxMode: opts.embedSandboxMode ?? "scripts",
          allowExternalEmbedUrls: opts.allowExternalEmbedUrls ?? false,
        }),
      )}
    </div>
  `;
}

export function renderGroupedMessage(
  message: unknown,
  messageKey: string,
  opts: {
    isStreaming: boolean;
    showReasoning: boolean;
    showToolCalls?: boolean;
    autoExpandToolCalls?: boolean;
    isToolMessageExpanded?: (messageId: string) => boolean;
    onToggleToolMessageExpanded?: (messageId: string) => void;
    isToolExpanded?: (toolCardId: string) => boolean;
    onToggleToolExpanded?: (toolCardId: string) => void;
    onRequestUpdate?: () => void;
    canvasHostUrl?: string | null;
    basePath?: string;
    localMediaPreviewRoots?: readonly string[];
    assistantAttachmentAuthToken?: string | null;
    embedSandboxMode?: EmbedSandboxMode;
    allowExternalEmbedUrls?: boolean;
  },
  onOpenSidebar?: (content: SidebarContent) => void,
) {
  const m = message as Record<string, unknown>;
  const role = typeof m.role === "string" ? m.role : "unknown";
  const normalizedRole = normalizeRoleForGrouping(role);
  const isToolResult =
    isToolResultMessage(message) ||
    role.toLowerCase() === "toolresult" ||
    role.toLowerCase() === "tool_result" ||
    typeof m.toolCallId === "string" ||
    typeof m.tool_call_id === "string";

  const toolCards =
    (opts.showToolCalls ?? true) ? extractToolCards(message, messageKey) : [];
  const hasToolCards = toolCards.length > 0;
  const images = extractImages(message);
  const hasImages = images.length > 0;

  const normalizedMessage = normalizeMessage(message);
  const extractedText = normalizedMessage.content
    .reduce<string[]>((lines, item) => {
      if (item.type === "text" && typeof item.text === "string") {
        lines.push(item.text);
      }
      return lines;
    }, [])
    .join("\n")
    .trim();
  const assistantAttachments = normalizedMessage.content.filter(
    (item): item is Extract<MessageContentItem, { type: "attachment" }> =>
      item.type === "attachment",
  );
  const assistantViewBlocks = normalizedMessage.content.filter(
    (item): item is Extract<MessageContentItem, { type: "canvas" }> =>
      item.type === "canvas",
  );
  const extractedThinking =
    opts.showReasoning && role === "assistant"
      ? extractThinkingCached(message)
      : null;
  const markdownBase = extractedText?.trim() ? extractedText : null;
  const reasoningMarkdown = extractedThinking
    ? formatReasoningMarkdown(extractedThinking)
    : null;
  const markdown = markdownBase;
  const canCopyMarkdown = role === "assistant" && Boolean(markdown?.trim());
  const canExpand =
    role === "assistant" && Boolean(onOpenSidebar && markdown?.trim());

  const jsonResult =
    markdown && !opts.isStreaming ? detectJson(markdown) : null;

  const bubbleClasses = [
    "chat-bubble",
    opts.isStreaming ? "streaming" : "",
    "fade-in",
  ]
    .filter(Boolean)
    .join(" ");

  const visibleToolCards = hasToolCards && (opts.showToolCalls ?? true);
  if (
    !markdown &&
    !visibleToolCards &&
    !hasImages &&
    assistantAttachments.length === 0 &&
    assistantViewBlocks.length === 0 &&
    !normalizedMessage.replyTarget
  ) {
    return nothing;
  }

  const isToolMessage = normalizedRole === "tool" || isToolResult;
  const toolMessageDisclosureId = `toolmsg:${messageKey}`;
  const toolMessageExpanded =
    opts.isToolMessageExpanded?.(toolMessageDisclosureId) ?? false;
  const toolNames = [...new Set(toolCards.map((c) => c.name))];
  const toolSummaryLabel =
    toolNames.length <= 3
      ? toolNames.join(", ")
      : `${toolNames.slice(0, 2).join(", ")} +${toolNames.length - 2} more`;
  const toolPreview =
    markdown && !toolSummaryLabel
      ? markdown.trim().replace(/\s+/g, " ").slice(0, 120)
      : "";
  const singleToolCard = toolCards.length === 1 ? toolCards[0] : null;
  const toolMessageLabel =
    singleToolCard && !markdown && !hasImages
      ? singleToolCard.outputText?.trim()
        ? "执行结果"
        : "执行命令"
      : "执行结果";

  const hasActions = canCopyMarkdown || canExpand;

  return html`
    <div class="${bubbleClasses}">
      ${renderReplyPill(normalizedMessage.replyTarget)}
      ${hasActions
        ? html`<div class="chat-bubble-actions">
            ${canExpand
              ? renderExpandButton(markdown!, onOpenSidebar!)
              : nothing}
            ${canCopyMarkdown ? renderCopyAsMarkdownButton(markdown!) : nothing}
          </div>`
        : nothing}
      ${isToolMessage
        ? html`
            <div
              class="chat-tool-msg-collapse chat-tool-msg-collapse--manual ${toolMessageExpanded
                ? "is-open"
                : ""}"
            >
              <button
                class="chat-tool-msg-summary"
                type="button"
                aria-expanded=${String(toolMessageExpanded)}
                @click=${() =>
                  opts.onToggleToolMessageExpanded?.(toolMessageDisclosureId)}
              >
                <span class="chat-tool-msg-summary__icon">${icons.zap}</span>
                <span class="chat-tool-msg-summary__label"
                  >${toolMessageLabel}</span
                >
                ${toolSummaryLabel
                  ? html`<span class="chat-tool-msg-summary__names"
                      >${toolSummaryLabel}</span
                    >`
                  : toolPreview
                    ? html`<span class="chat-tool-msg-summary__preview"
                        >${toolPreview}</span
                      >`
                    : nothing}
              </button>
              ${toolMessageExpanded
                ? html`
                    <div class="chat-tool-msg-body">
                      ${renderMessageImages(images)}
                      ${renderAssistantAttachments(
                        assistantAttachments,
                        opts.localMediaPreviewRoots ?? [],
                        opts.basePath,
                        opts.assistantAttachmentAuthToken,
                        opts.onRequestUpdate,
                      )}
                      ${reasoningMarkdown
                        ? html`<div class="chat-thinking">
                            ${unsafeHTML(
                              toSanitizedMarkdownHtml(reasoningMarkdown),
                            )}
                          </div>`
                        : nothing}
                      ${jsonResult
                        ? html`<details
                            class="chat-json-collapse"
                            ?open=${Boolean(opts.autoExpandToolCalls)}
                          >
                            <summary class="chat-json-summary">
                              <span class="chat-json-badge">JSON</span>
                              <span class="chat-json-label"
                                >${jsonSummaryLabel(jsonResult.parsed)}</span
                              >
                            </summary>
                            <pre
                              class="chat-json-content"
                            ><code>${jsonResult.pretty}</code></pre>
                          </details>`
                        : markdown
                          ? html`<div
                              class="chat-text"
                              dir="${detectTextDirection(markdown)}"
                            >
                              ${unsafeHTML(toSanitizedMarkdownHtml(markdown))}
                            </div>`
                          : nothing}
                      ${hasToolCards
                        ? singleToolCard && !markdown && !hasImages
                          ? renderExpandedToolCardContent(
                              singleToolCard,
                              onOpenSidebar,
                              opts.canvasHostUrl,
                              opts.embedSandboxMode ?? "scripts",
                              opts.allowExternalEmbedUrls ?? false,
                            )
                          : renderInlineToolCards(toolCards, {
                              messageKey,
                              onOpenSidebar,
                              isToolExpanded: opts.isToolExpanded,
                              onToggleToolExpanded: opts.onToggleToolExpanded,
                              canvasHostUrl: opts.canvasHostUrl,
                              embedSandboxMode:
                                opts.embedSandboxMode ?? "scripts",
                              allowExternalEmbedUrls:
                                opts.allowExternalEmbedUrls ?? false,
                            })
                        : nothing}
                    </div>
                  `
                : nothing}
            </div>
          `
        : html`
            ${renderMessageImages(images)}
            ${renderAssistantAttachments(
              assistantAttachments,
              opts.localMediaPreviewRoots ?? [],
              opts.basePath,
              opts.assistantAttachmentAuthToken,
              opts.onRequestUpdate,
            )}
            ${reasoningMarkdown
              ? html`<div class="chat-thinking">
                  ${unsafeHTML(toSanitizedMarkdownHtml(reasoningMarkdown))}
                </div>`
              : nothing}
            ${normalizedRole === "assistant" && assistantViewBlocks.length > 0
              ? html`${assistantViewBlocks.map(
                  (block) =>
                    html`${renderToolPreview(block.preview, "chat_message", {
                      onOpenSidebar,
                      rawText: block.rawText ?? null,
                      canvasHostUrl: opts.canvasHostUrl,
                      embedSandboxMode: opts.embedSandboxMode ?? "scripts",
                    })}
                    ${block.rawText
                      ? renderRawOutputToggle(block.rawText)
                      : nothing}`,
                )}`
              : nothing}
            ${jsonResult
              ? html`<details class="chat-json-collapse">
                  <summary class="chat-json-summary">
                    <span class="chat-json-badge">JSON</span>
                    <span class="chat-json-label"
                      >${jsonSummaryLabel(jsonResult.parsed)}</span
                    >
                  </summary>
                  <pre
                    class="chat-json-content"
                  ><code>${jsonResult.pretty}</code></pre>
                </details>`
              : markdown
                ? html`<div
                    class="chat-text"
                    dir="${detectTextDirection(markdown)}"
                  >
                    ${unsafeHTML(toSanitizedMarkdownHtml(markdown))}
                  </div>`
                : nothing}
            ${hasToolCards
              ? renderInlineToolCards(toolCards, {
                  messageKey,
                  onOpenSidebar,
                  isToolExpanded: opts.isToolExpanded,
                  onToggleToolExpanded: opts.onToggleToolExpanded,
                  canvasHostUrl: opts.canvasHostUrl,
                  embedSandboxMode: opts.embedSandboxMode ?? "scripts",
                  allowExternalEmbedUrls: opts.allowExternalEmbedUrls ?? false,
                })
              : nothing}
          `}
    </div>
  `;
}
