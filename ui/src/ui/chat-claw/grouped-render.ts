import { html, nothing } from "lit";
import type { AssistantIdentity } from "../assistant-identity.ts";
import type { EmbedSandboxMode } from "../embed-sandbox.ts";
import type { SidebarContent } from "../sidebar-content.ts";
import type { MessageGroup } from "../types/chat-types.ts";
import { renderAvatar } from "./grouped-render/avatar.ts";
import { renderMessageMeta, extractGroupMeta } from "./grouped-render/meta.ts";
import {
  renderDeleteButton,
  renderTtsButton,
} from "./grouped-render/controls.ts";
import { renderGroupedMessage } from "./grouped-render/message.ts";
import { resetAssistantAttachmentAvailabilityCacheForTest } from "./grouped-render/attachments.ts";
import { isTtsSupported } from "./speech.ts";
import { normalizeRoleForGrouping } from "./message-normalizer.ts";

export { resetAssistantAttachmentAvailabilityCacheForTest };

export function renderReadingIndicatorGroup(
  assistant?: AssistantIdentity,
  basePath?: string,
) {
  return html`
    <div class="chat-group assistant">
      ${renderAvatar("assistant", assistant, basePath)}
      <div class="chat-group-messages">
        <div class="chat-bubble chat-reading-indicator" aria-hidden="true">
          <span class="chat-reading-indicator__dots">
            <span></span><span></span><span></span>
          </span>
        </div>
      </div>
    </div>
  `;
}

export function renderStreamingGroup(
  text: string,
  startedAt: number,
  onOpenSidebar?: (content: SidebarContent) => void,
  assistant?: AssistantIdentity,
  basePath?: string,
) {
  const timestamp = new Date(startedAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const name = assistant?.name ?? "Assistant";

  return html`
    <div class="chat-group assistant">
      ${renderAvatar("assistant", assistant, basePath)}
      <div class="chat-group-messages">
        ${renderGroupedMessage(
          {
            role: "assistant",
            content: [{ type: "text", text }],
            timestamp: startedAt,
          },
          `stream:${startedAt}`,
          { isStreaming: true, showReasoning: false },
          onOpenSidebar,
        )}
        <div class="chat-group-footer">
          <span class="chat-sender-name">${name}</span>
          <span class="chat-group-timestamp">${timestamp}</span>
        </div>
      </div>
    </div>
  `;
}

export function renderMessageGroup(
  group: MessageGroup,
  opts: {
    onOpenSidebar?: (content: SidebarContent) => void;
    showReasoning: boolean;
    showToolCalls?: boolean;
    autoExpandToolCalls?: boolean;
    isToolMessageExpanded?: (messageId: string) => boolean;
    onToggleToolMessageExpanded?: (messageId: string) => void;
    isToolExpanded?: (toolCardId: string) => boolean;
    onToggleToolExpanded?: (toolCardId: string) => void;
    onRequestUpdate?: () => void;
    assistantName?: string;
    assistantAvatar?: string | null;
    basePath?: string;
    localMediaPreviewRoots?: readonly string[];
    assistantAttachmentAuthToken?: string | null;
    canvasHostUrl?: string | null;
    embedSandboxMode?: EmbedSandboxMode;
    allowExternalEmbedUrls?: boolean;
    contextWindow?: number | null;
    onDelete?: () => void;
  },
) {
  const normalizedRole = normalizeRoleForGrouping(group.role);
  const assistantName = opts.assistantName ?? "Assistant";
  const userLabel = group.senderLabel?.trim();
  const who =
    normalizedRole === "user"
      ? (userLabel ?? "You")
      : normalizedRole === "assistant"
        ? assistantName
        : normalizedRole === "tool"
          ? "Tool"
          : normalizedRole;
  const roleClass =
    normalizedRole === "user"
      ? "user"
      : normalizedRole === "assistant"
        ? "assistant"
        : normalizedRole === "tool"
          ? "tool"
          : "other";
  const timestamp = new Date(group.timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const meta = extractGroupMeta(group, opts.contextWindow ?? null);

  return html`
    <div class="chat-group ${roleClass}">
      ${renderAvatar(
        group.role,
        {
          name: assistantName,
          avatar: opts.assistantAvatar ?? null,
        },
        opts.basePath,
      )}
      <div class="chat-group-messages">
        ${group.messages.map((item, index) =>
          renderGroupedMessage(
            item.message,
            item.key,
            {
              isStreaming:
                group.isStreaming && index === group.messages.length - 1,
              showReasoning: opts.showReasoning,
              showToolCalls: opts.showToolCalls ?? true,
              autoExpandToolCalls: opts.autoExpandToolCalls ?? false,
              isToolMessageExpanded: opts.isToolMessageExpanded,
              onToggleToolMessageExpanded: opts.onToggleToolMessageExpanded,
              isToolExpanded: opts.isToolExpanded,
              onToggleToolExpanded: opts.onToggleToolExpanded,
              onRequestUpdate: opts.onRequestUpdate,
              canvasHostUrl: opts.canvasHostUrl,
              basePath: opts.basePath,
              localMediaPreviewRoots: opts.localMediaPreviewRoots,
              assistantAttachmentAuthToken: opts.assistantAttachmentAuthToken,
              embedSandboxMode: opts.embedSandboxMode,
            },
            opts.onOpenSidebar,
          ),
        )}
        <div class="chat-group-footer">
          <span class="chat-sender-name">${who}</span>
          <span class="chat-group-timestamp">${timestamp}</span>
          ${renderMessageMeta(meta)}
          ${normalizedRole === "assistant" && isTtsSupported()
            ? renderTtsButton(group)
            : nothing}
          ${opts.onDelete
            ? renderDeleteButton(
                opts.onDelete,
                normalizedRole === "user" ? "left" : "right",
              )
            : nothing}
        </div>
      </div>
    </div>
  `;
}
