import { html, nothing, type TemplateResult } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { icons } from "../../icons.ts";
import { toSanitizedMarkdownHtml } from "../../markdown.ts";
import type {
  CompactionStatus,
  FallbackStatus,
} from "../../app-tool-stream.ts";
import type { ChatSideResult } from "../../chat-claw/side-result.ts";
import { getPinnedMessageSummary } from "../../chat-claw/pinned-summary.ts";
import {
  CATEGORY_LABELS,
  type SlashCommandCategory,
  type SlashCommandDef,
} from "../../chat-claw/slash-commands.ts";
import type { GatewaySessionRow } from "../../types.ts";
import type { PinnedMessages } from "../../chat-claw/pinned-messages.ts";
import { formatRelativeTimestamp } from "../../format.ts";
import { agentLogoUrl, resolveAgentAvatarUrl } from "../agents-utils.ts";
import { detectTextDirection } from "../../text-direction.ts";
import type { ChatProps } from "./types.ts";
import { chatViewState } from "./state.ts";
import {
  selectSlashArg,
  selectSlashCommand,
  tabCompleteSlashCommand,
} from "./interaction.ts";

const COMPACTION_TOAST_DURATION_MS = 5000;
const FALLBACK_TOAST_DURATION_MS = 8000;

const WELCOME_SUGGESTIONS = [
  "What can you do?",
  "Summarize my recent sessions",
  "Help me configure a channel",
  "Check system health",
];

function resolveSessionLabel(session: GatewaySessionRow): string {
  return session.displayName ?? session.label ?? session.key;
}

function renderSessionSidebar(
  props: ChatProps,
  requestUpdate: () => void,
): TemplateResult {
  const query = chatViewState.sessionSidebarSearch.trim().toLowerCase();
  const sessions = [...(props.sessions?.sessions ?? [])].toSorted((a, b) => {
    const at = a.updatedAt ?? 0;
    const bt = b.updatedAt ?? 0;
    return bt - at;
  });
  const filteredSessions = query
    ? sessions.filter((session) => {
        const label = resolveSessionLabel(session).toLowerCase();
        const key = session.key.toLowerCase();
        const kind = (session.kind ?? "").toLowerCase();
        return (
          label.includes(query) || key.includes(query) || kind.includes(query)
        );
      })
    : sessions;
  const totalCount = props.sessions?.count ?? sessions.length;
  const collapsed = chatViewState.sessionSidebarCollapsed;

  return html`
    <aside
      class=${`chat-session-sidebar ${collapsed ? "chat-session-sidebar--collapsed" : ""}`}
    >
      <div class="chat-session-sidebar__header">
        <div class="chat-session-sidebar__title-wrap">
          <div class="chat-session-sidebar__title">对话列表</div>
          <div class="chat-session-sidebar__meta">
            ${totalCount} 个 · 当前显示 ${filteredSessions.length} 个
          </div>
        </div>
        <button
          class="btn btn--ghost chat-session-sidebar__toggle"
          type="button"
          @click=${() => {
            chatViewState.sessionSidebarCollapsed =
              !chatViewState.sessionSidebarCollapsed;
            requestUpdate();
          }}
          aria-label=${collapsed ? "展开会话栏" : "收起会话栏"}
          title=${collapsed ? "展开会话栏" : "收起会话栏"}
        >
          <span
            class="chat-session-sidebar__toggle-icon ${collapsed
              ? "chat-session-sidebar__toggle-icon--collapsed"
              : ""}"
            >${icons.panelLeftClose}</span
          >
        </button>
      </div>

      ${collapsed
        ? nothing
        : html`
            <button
              class="btn btn--ghost chat-session-sidebar__new"
              type="button"
              ?disabled=${!props.connected}
              @click=${() => props.onNewSession()}
              aria-label="新建对话"
              title="新建对话"
            >
              <span class="chat-session-sidebar__new-icon">${icons.plus}</span>
              <span class="chat-session-sidebar__new-label">新建对话</span>
            </button>

            <label
              class="chat-session-sidebar__search"
              aria-label="搜索对话名称"
            >
              <span class="chat-session-sidebar__search-icon"
                >${icons.search}</span
              >
              <input
                class="chat-session-sidebar__search-input"
                type="search"
                placeholder="搜索对话名称"
                .value=${chatViewState.sessionSidebarSearch}
                @input=${(event: Event) => {
                  chatViewState.sessionSidebarSearch = (
                    event.target as HTMLInputElement
                  ).value;
                  requestUpdate();
                }}
              />
            </label>
          `}
      ${collapsed
        ? nothing
        : html`
            <div
              class="chat-session-sidebar__list"
              role="list"
              aria-label="会话列表"
            >
              ${filteredSessions.length === 0
                ? html`<div class="chat-session-sidebar__empty">
                    ${query ? "没有匹配的会话" : "暂无历史会话"}
                  </div>`
                : repeat(
                    filteredSessions,
                    (session) => session.key,
                    (session) => {
                      const active = session.key === props.sessionKey;
                      const label = resolveSessionLabel(session);
                      const updated = session.updatedAt
                        ? formatRelativeTimestamp(session.updatedAt)
                        : "暂无更新时间";
                      return html`
                        <button
                          class=${`chat-session-sidebar__item ${active ? "chat-session-sidebar__item--active" : ""}`}
                          type="button"
                          role="listitem"
                          aria-current=${active ? "true" : "false"}
                          title=${label}
                          @click=${() => {
                            if (props.onSessionSelect) {
                              props.onSessionSelect(session.key);
                              return;
                            }
                            props.onSessionKeyChange(session.key);
                          }}
                        >
                          <span class="chat-session-sidebar__item-main">
                            <span class="chat-session-sidebar__item-title"
                              >${label}</span
                            >
                            <span class="chat-session-sidebar__item-subtitle"
                              >${updated}</span
                            >
                          </span>
                        </button>
                      `;
                    },
                  )}
            </div>
          `}
    </aside>
  `;
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    return null;
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

let cachedThemeNoticeColors: {
  warnHex: string;
  dangerHex: string;
  warnRgb: [number, number, number];
  dangerRgb: [number, number, number];
} | null = null;

function getThemeNoticeColors() {
  if (cachedThemeNoticeColors) {
    return cachedThemeNoticeColors;
  }
  const rootStyle = getComputedStyle(document.documentElement);
  const warnHex = rootStyle.getPropertyValue("--warn").trim() || "#f59e0b";
  const dangerHex = rootStyle.getPropertyValue("--danger").trim() || "#ef4444";
  cachedThemeNoticeColors = {
    warnHex,
    dangerHex,
    warnRgb: parseHexRgb(warnHex) ?? [245, 158, 11],
    dangerRgb: parseHexRgb(dangerHex) ?? [239, 68, 68],
  };
  return cachedThemeNoticeColors;
}

function formatTokensCompact(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(n);
}

export function renderCompactionIndicator(
  status: CompactionStatus | null | undefined,
) {
  if (!status) {
    return nothing;
  }
  if (status.phase === "active" || status.phase === "retrying") {
    return html`
      <div
        class="compaction-indicator compaction-indicator--active"
        role="status"
        aria-live="polite"
      >
        ${icons.loader} Compacting context...
      </div>
    `;
  }
  if (status.completedAt) {
    const elapsed = Date.now() - status.completedAt;
    if (elapsed < COMPACTION_TOAST_DURATION_MS) {
      return html`
        <div
          class="compaction-indicator compaction-indicator--complete"
          role="status"
          aria-live="polite"
        >
          ${icons.check} Context compacted
        </div>
      `;
    }
  }
  return nothing;
}

export function renderFallbackIndicator(
  status: FallbackStatus | null | undefined,
) {
  if (!status) {
    return nothing;
  }
  const phase = status.phase ?? "active";
  const elapsed = Date.now() - status.occurredAt;
  if (elapsed >= FALLBACK_TOAST_DURATION_MS) {
    return nothing;
  }
  const details = [
    `Selected: ${status.selected}`,
    phase === "cleared"
      ? `Active: ${status.selected}`
      : `Active: ${status.active}`,
    phase === "cleared" && status.previous
      ? `Previous fallback: ${status.previous}`
      : null,
    status.reason ? `Reason: ${status.reason}` : null,
    status.attempts.length > 0
      ? `Attempts: ${status.attempts.slice(0, 3).join(" | ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const message =
    phase === "cleared"
      ? `Fallback cleared: ${status.selected}`
      : `Fallback active: ${status.active}`;
  const className =
    phase === "cleared"
      ? "compaction-indicator compaction-indicator--fallback-cleared"
      : "compaction-indicator compaction-indicator--fallback";
  const icon = phase === "cleared" ? icons.check : icons.brain;
  return html`
    <div class=${className} role="status" aria-live="polite" title=${details}>
      ${icon} ${message}
    </div>
  `;
}

export function renderSideResult(
  sideResult: ChatSideResult | null | undefined,
  onDismiss?: () => void,
): TemplateResult | typeof nothing {
  if (!sideResult) {
    return nothing;
  }
  return html`
    <section
      class=${`chat-side-result ${sideResult.isError ? "chat-side-result--error" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="BTW side result"
    >
      <div class="chat-side-result__header">
        <div class="chat-side-result__label-row">
          <span class="chat-side-result__label">BTW</span>
          <span class="chat-side-result__meta">Not saved to chat history</span>
        </div>
        <button
          class="btn chat-side-result__dismiss"
          type="button"
          aria-label="Dismiss BTW result"
          title="Dismiss"
          @click=${() => onDismiss?.()}
        >
          ${icons.x}
        </button>
      </div>
      <div class="chat-side-result__question">${sideResult.question}</div>
      <div
        class="chat-side-result__body"
        dir=${detectTextDirection(sideResult.text)}
      >
        ${unsafeHTML(toSanitizedMarkdownHtml(sideResult.text))}
      </div>
    </section>
  `;
}

export function renderContextNotice(
  session: GatewaySessionRow | undefined,
  defaultContextTokens: number | null,
) {
  if (session?.totalTokensFresh === false) {
    return nothing;
  }
  const used = session?.totalTokens ?? 0;
  const limit = session?.contextTokens ?? defaultContextTokens ?? 0;
  if (!used || !limit) {
    return nothing;
  }
  const ratio = used / limit;
  if (ratio < 0.85) {
    return nothing;
  }
  const pct = Math.min(Math.round(ratio * 100), 100);
  const { warnRgb, dangerRgb } = getThemeNoticeColors();
  const [wr, wg, wb] = warnRgb;
  const [dr, dg, db] = dangerRgb;
  const t = Math.min(Math.max((ratio - 0.85) / 0.1, 0), 1);
  const r = Math.round(wr + (dr - wr) * t);
  const g = Math.round(wg + (dg - wg) * t);
  const b = Math.round(wb + (db - wb) * t);
  const color = `rgb(${r}, ${g}, ${b})`;
  const bgOpacity = 0.08 + 0.08 * t;
  const bg = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  return html`
    <div
      class="context-notice"
      role="status"
      style="--ctx-color:${color};--ctx-bg:${bg}"
    >
      <svg
        class="context-notice__icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
        />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>${pct}% context used</span>
      <span class="context-notice__detail"
        >${formatTokensCompact(used)} / ${formatTokensCompact(limit)}</span
      >
    </div>
  `;
}

export function renderWelcomeState(props: ChatProps): TemplateResult {
  const name = props.assistantName || "Assistant";
  const avatar = resolveAgentAvatarUrl({
    identity: {
      avatar: props.assistantAvatar ?? undefined,
      avatarUrl: props.assistantAvatarUrl ?? undefined,
    },
  });
  const logoUrl = agentLogoUrl(props.basePath ?? "");

  return html`
    <div class="agent-chat__welcome" style="--agent-color: var(--accent)">
      <div class="agent-chat__welcome-glow"></div>
      ${avatar
        ? html`<img
            src=${avatar}
            alt=${name}
            style="width:56px; height:56px; border-radius:50%; object-fit:cover;"
          />`
        : html`<div class="agent-chat__avatar agent-chat__avatar--logo">
            <img src=${logoUrl} alt="OpenClaw" />
          </div>`}
      <h2>${name}</h2>
      <div class="agent-chat__badges">
        <span class="agent-chat__badge"
          ><img src=${logoUrl} alt="" /> Ready to chat</span
        >
      </div>
      <p class="agent-chat__hint">
        Type a message below &middot; <kbd>/</kbd> for commands
      </p>
      <div class="agent-chat__suggestions">
        ${WELCOME_SUGGESTIONS.map(
          (text) => html`
            <button
              type="button"
              class="agent-chat__suggestion"
              @click=${() => {
                props.onDraftChange(text);
                props.onSend();
              }}
            >
              ${text}
            </button>
          `,
        )}
      </div>
    </div>
  `;
}

export function renderSearchBar(
  requestUpdate: () => void,
): TemplateResult | typeof nothing {
  if (!chatViewState.searchOpen) {
    return nothing;
  }
  return html`
    <div class="agent-chat__search-bar">
      ${icons.search}
      <input
        type="text"
        placeholder="Search messages..."
        aria-label="Search messages"
        .value=${chatViewState.searchQuery}
        @input=${(e: Event) => {
          chatViewState.searchQuery = (e.target as HTMLInputElement).value;
          requestUpdate();
        }}
      />
      <button
        class="btn btn--ghost"
        aria-label="Close search"
        @click=${() => {
          chatViewState.searchOpen = false;
          chatViewState.searchQuery = "";
          requestUpdate();
        }}
      >
        ${icons.x}
      </button>
    </div>
  `;
}

export function renderPinnedSection(
  props: ChatProps,
  pinned: PinnedMessages,
  requestUpdate: () => void,
): TemplateResult | typeof nothing {
  const messages = Array.isArray(props.messages) ? props.messages : [];
  const entries: Array<{ index: number; text: string; role: string }> = [];
  for (const idx of pinned.indices) {
    const msg = messages[idx] as Record<string, unknown> | undefined;
    if (!msg) {
      continue;
    }
    const text = getPinnedMessageSummary(msg);
    const role = typeof msg.role === "string" ? msg.role : "unknown";
    entries.push({ index: idx, text, role });
  }
  if (entries.length === 0) {
    return nothing;
  }
  return html`
    <div class="agent-chat__pinned">
      <button
        class="agent-chat__pinned-toggle"
        @click=${() => {
          chatViewState.pinnedExpanded = !chatViewState.pinnedExpanded;
          requestUpdate();
        }}
      >
        ${icons.bookmark} ${entries.length} pinned
        <span
          class="collapse-chevron ${chatViewState.pinnedExpanded
            ? ""
            : "collapse-chevron--collapsed"}"
          >${icons.chevronDown}</span
        >
      </button>
      ${chatViewState.pinnedExpanded
        ? html`
            <div class="agent-chat__pinned-list">
              ${entries.map(
                ({ index, text, role }) => html`
                  <div class="agent-chat__pinned-item">
                    <span class="agent-chat__pinned-role"
                      >${role === "user" ? "You" : "Assistant"}</span
                    >
                    <span class="agent-chat__pinned-text"
                      >${text.slice(0, 100)}${text.length > 100
                        ? "..."
                        : ""}</span
                    >
                    <button
                      class="btn btn--ghost"
                      @click=${() => {
                        pinned.unpin(index);
                        requestUpdate();
                      }}
                      title="Unpin"
                    >
                      ${icons.x}
                    </button>
                  </div>
                `,
              )}
            </div>
          `
        : nothing}
    </div>
  `;
}

export function renderSlashMenu(
  requestUpdate: () => void,
  props: ChatProps,
): TemplateResult | typeof nothing {
  if (!chatViewState.slashMenuOpen) {
    return nothing;
  }

  if (
    chatViewState.slashMenuMode === "args" &&
    chatViewState.slashMenuCommand &&
    chatViewState.slashMenuArgItems.length > 0
  ) {
    return html`
      <div class="slash-menu" role="listbox" aria-label="Command arguments">
        <div class="slash-menu-group">
          <div class="slash-menu-group__label">
            /${chatViewState.slashMenuCommand.name}
            ${chatViewState.slashMenuCommand.description}
          </div>
          ${chatViewState.slashMenuArgItems.map(
            (arg, i) => html`
              <div
                class="slash-menu-item ${i === chatViewState.slashMenuIndex
                  ? "slash-menu-item--active"
                  : ""}"
                role="option"
                aria-selected=${i === chatViewState.slashMenuIndex}
                @click=${() => selectSlashArg(arg, props, requestUpdate, true)}
                @mouseenter=${() => {
                  chatViewState.slashMenuIndex = i;
                  requestUpdate();
                }}
              >
                ${chatViewState.slashMenuCommand?.icon
                  ? html`<span class="slash-menu-icon"
                      >${icons[chatViewState.slashMenuCommand.icon]}</span
                    >`
                  : nothing}
                <span class="slash-menu-name">${arg}</span>
                <span class="slash-menu-desc"
                  >/${chatViewState.slashMenuCommand?.name} ${arg}</span
                >
              </div>
            `,
          )}
        </div>
        <div class="slash-menu-footer">
          <kbd>↑↓</kbd> navigate <kbd>Tab</kbd> fill <kbd>Enter</kbd> run
          <kbd>Esc</kbd> close
        </div>
      </div>
    `;
  }

  if (chatViewState.slashMenuItems.length === 0) {
    return nothing;
  }

  const grouped = new Map<
    SlashCommandCategory,
    Array<{ cmd: SlashCommandDef; globalIdx: number }>
  >();
  for (let i = 0; i < chatViewState.slashMenuItems.length; i++) {
    const cmd = chatViewState.slashMenuItems[i];
    const cat = cmd.category ?? "session";
    let list = grouped.get(cat);
    if (!list) {
      list = [];
      grouped.set(cat, list);
    }
    list.push({ cmd, globalIdx: i });
  }

  const sections: TemplateResult[] = [];
  for (const [cat, entries] of grouped) {
    sections.push(html`
      <div class="slash-menu-group">
        <div class="slash-menu-group__label">${CATEGORY_LABELS[cat]}</div>
        ${entries.map(
          ({ cmd, globalIdx }) => html`
            <div
              class="slash-menu-item ${globalIdx ===
              chatViewState.slashMenuIndex
                ? "slash-menu-item--active"
                : ""}"
              role="option"
              aria-selected=${globalIdx === chatViewState.slashMenuIndex}
              @click=${() => selectSlashCommand(cmd, props, requestUpdate)}
              @mouseenter=${() => {
                chatViewState.slashMenuIndex = globalIdx;
                requestUpdate();
              }}
            >
              ${cmd.icon
                ? html`<span class="slash-menu-icon">${icons[cmd.icon]}</span>`
                : nothing}
              <span class="slash-menu-name">/${cmd.name}</span>
              ${cmd.args
                ? html`<span class="slash-menu-args">${cmd.args}</span>`
                : nothing}
              <span class="slash-menu-desc">${cmd.description}</span>
              ${cmd.argOptions?.length
                ? html`<span class="slash-menu-badge"
                    >${cmd.argOptions.length} options</span
                  >`
                : cmd.executeLocal && !cmd.args
                  ? html` <span class="slash-menu-badge">instant</span> `
                  : nothing}
            </div>
          `,
        )}
      </div>
    `);
  }

  return html`
    <div class="slash-menu" role="listbox" aria-label="Slash commands">
      ${sections}
      <div class="slash-menu-footer">
        <kbd>↑↓</kbd> navigate <kbd>Tab</kbd> fill <kbd>Enter</kbd> select
        <kbd>Esc</kbd> close
      </div>
    </div>
  `;
}

export function renderAttachmentPreview(
  props: ChatProps,
): TemplateResult | typeof nothing {
  const attachments = props.attachments ?? [];
  if (attachments.length === 0) {
    return nothing;
  }
  return html`
    <div class="chat-attachments-preview">
      ${attachments.map(
        (att) => html`
          <div class="chat-attachment-thumb">
            <img src=${att.dataUrl} alt="Attachment preview" />
            <button
              class="chat-attachment-remove"
              type="button"
              aria-label="Remove attachment"
              @click=${() => {
                const next = (props.attachments ?? []).filter(
                  (a) => a.id !== att.id,
                );
                props.onAttachmentsChange?.(next);
              }}
            >
              &times;
            </button>
          </div>
        `,
      )}
    </div>
  `;
}

export function renderSessionSidebarView(
  props: ChatProps,
  requestUpdate: () => void,
): TemplateResult {
  return renderSessionSidebar(props, requestUpdate);
}
