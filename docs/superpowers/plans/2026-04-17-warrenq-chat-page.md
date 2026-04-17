# Warrenq 综合助手聊天页面实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 Figma 设计，构建独立的 Warrenq 综合助手聊天全屏页面，包含侧边栏对话管理、消息流和 WebSocket 实时通信。

**Architecture:** Lit Web Components 组件组合模式。`warrenq-chat-page` 作为页面级组合器持有 WebSocket 连接和核心状态，通过 CustomEvent 向上冒泡、Lit property 向下传递数据。后端通过 Gildata 插件注册 `/warrenq-chat` GET 路由，返回独立 HTML 页面。

**Tech Stack:** TypeScript, Lit (Web Components), Vite (多页面构建), OpenClaw Gateway WebSocket

**Design Spec:** `docs/superpowers/specs/2026-04-17-warrenq-chat-page-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `ui/src/ui/views/warrenq-chat.types.ts` | 共享类型定义（Session, Message, 事件 detail） |
| Create | `ui/src/ui/views/warrenq-chat-message.ts` | 单条消息气泡组件 |
| Create | `ui/src/ui/views/warrenq-chat-input.ts` | 输入区域组件（textarea + 发送） |
| Create | `ui/src/ui/views/warrenq-chat-sidebar.ts` | 侧边栏组件（Logo + 对话列表） |
| Create | `ui/src/ui/views/warrenq-chat-main.ts` | 主聊天区域组件（消息流容器） |
| Create | `ui/src/ui/views/warrenq-chat-page.ts` | 页面组合器（WebSocket + 状态中心） |
| Create | `ui/src/warrenq-chat-entry.ts` | 独立入口（注册组件 + 挂载） |
| Create | `ui/warrenq-chat.html` | 独立 HTML 页面 |
| Modify | `ui/vite.config.ts` | 多页面构建配置 |
| Create | `extensions/gildata/src/warrenq-chat-route.ts` | 后端路由（/warrenq-chat GET） |
| Modify | `extensions/gildata/src/index.ts` | 注册新路由 |
| Modify | `ui/src/ui/views/warrenq-login.ts` | 登录成功后跳转到 /warrenq-chat |

---

### Task 1: 创建共享类型定义

**Files:**
- Create: `ui/src/ui/views/warrenq-chat.types.ts`

- [ ] **Step 1: 创建类型文件**

```typescript
// ui/src/ui/views/warrenq-chat.types.ts

/** 对话会话 */
export interface WarrenqSession {
  key: string;
  title: string;
  updatedAt: number;
}

/** 聊天消息 */
export interface WarrenqMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  failed?: boolean;
}

/** 新建对话事件 detail */
export interface WarrenqNewSessionDetail {
  // 空载体，仅表示用户点击了新建
}

/** 切换对话事件 detail */
export interface WarrenqSwitchSessionDetail {
  sessionKey: string;
}

/** 删除对话事件 detail */
export interface WarrenqDeleteSessionDetail {
  sessionKey: string;
}

/** 发送消息事件 detail */
export interface WarrenqSendMessageDetail {
  content: string;
}

/** 重试消息事件 detail */
export interface WarrenqRetryMessageDetail {
  messageId: string;
}

/** 事件名称常量 */
export const WARRENQ_EVENTS = {
  NEW_SESSION: "warrenq-new-session",
  SWITCH_SESSION: "warrenq-switch-session",
  DELETE_SESSION: "warrenq-delete-session",
  SEND_MESSAGE: "warrenq-send-message",
  RETRY_MESSAGE: "warrenq-retry-message",
} as const;
```

- [ ] **Step 2: 验证文件无类型错误**

Run: `cd /Volumes/Data/Project/StudyPro/AiPro/openclaw && pnpm tsgo --noEmit ui/src/ui/views/warrenq-chat.types.ts 2>&1 | head -5`
Expected: 无错误输出或文件不在 tsgo 范围内（可忽略）

- [ ] **Step 3: 提交**

```bash
git add ui/src/ui/views/warrenq-chat.types.ts
git commit -m "feat(warrenq): add shared types for chat page components"
```

---

### Task 2: 创建消息气泡组件

**Files:**
- Create: `ui/src/ui/views/warrenq-chat-message.ts`

- [ ] **Step 1: 实现消息气泡组件**

```typescript
// ui/src/ui/views/warrenq-chat-message.ts

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { WarrenqMessage } from "./warrenq-chat.types.js";
import { WARRENQ_EVENTS } from "./warrenq-chat.types.js";

@customElement("warrenq-chat-message")
export class WarrenqChatMessage extends LitElement {
  @property({ type: Object })
  message: WarrenqMessage = {
    id: "",
    role: "user",
    content: "",
    timestamp: 0,
  };

  static styles = css`
    :host {
      display: block;
      padding: 4px 0;
    }

    .message-row {
      display: flex;
      gap: 12px;
      max-width: 80%;
    }

    .message-row--user {
      margin-left: auto;
      flex-direction: row-reverse;
    }

    .message-row--assistant {
      margin-right: auto;
    }

    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }

    .avatar--user {
      background: var(--wq-accent, #667eea);
      color: #fff;
    }

    .avatar--assistant {
      background: var(--wq-assistant-bubble, #1e1e2e);
      border: 1px solid var(--wq-border, #30363d);
      color: var(--wq-text-primary, #e0e0e0);
    }

    .bubble {
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.6;
      word-break: break-word;
      white-space: pre-wrap;
      color: var(--wq-text-primary, #e0e0e0);
    }

    .bubble--user {
      background: var(--wq-user-bubble, #2d5aa0);
      border-bottom-right-radius: 4px;
    }

    .bubble--assistant {
      background: var(--wq-assistant-bubble, #1e1e2e);
      border: 1px solid var(--wq-border, #30363d);
      border-bottom-left-radius: 4px;
    }

    .message-time {
      font-size: 11px;
      color: var(--wq-text-secondary, #888);
      margin-top: 4px;
      text-align: right;
    }

    .message-row--assistant .message-time {
      text-align: left;
    }

    .bubble--failed {
      border: 1px solid rgba(220, 38, 38, 0.5);
      background: rgba(220, 38, 38, 0.08);
    }

    .retry-btn {
      margin-top: 6px;
      padding: 2px 8px;
      font-size: 12px;
      border: 1px solid rgba(220, 38, 38, 0.5);
      border-radius: 4px;
      background: transparent;
      color: #f87171;
      cursor: pointer;
    }

    .retry-btn:hover {
      background: rgba(220, 38, 38, 0.15);
    }
  `;

  private formatTime(ts: number): string {
    if (!ts) return "";
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }

  private handleRetry(): void {
    this.dispatchEvent(
      new CustomEvent(WARRENQ_EVENTS.RETRY_MESSAGE, {
        detail: { messageId: this.message.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const { role, content, timestamp, failed } = this.message;
    const isUser = role === "user";

    return html`
      <div class="message-row message-row--${role}">
        <div class="avatar avatar--${role}">
          ${isUser ? "U" : "AI"}
        </div>
        <div class="message-content">
          <div class="bubble bubble--${role} ${failed ? "bubble--failed" : ""}">
            ${content}
          </div>
          ${failed
            ? html`<button class="retry-btn" @click=${this.handleRetry}>重试</button>`
            : ""}
          <div class="message-time">${this.formatTime(timestamp)}</div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "warrenq-chat-message": WarrenqChatMessage;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add ui/src/ui/views/warrenq-chat-message.ts
git commit -m "feat(warrenq): add chat message bubble component"
```

---

### Task 3: 创建输入区域组件

**Files:**
- Create: `ui/src/ui/views/warrenq-chat-input.ts`

- [ ] **Step 1: 实现输入区域组件**

```typescript
// ui/src/ui/views/warrenq-chat-input.ts

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { WARRENQ_EVENTS } from "./warrenq-chat.types.js";

@customElement("warrenq-chat-input")
export class WarrenqChatInput extends LitElement {
  @property({ type: Boolean })
  disabled = false;

  @property({ type: Boolean })
  sending = false;

  @state()
  private _value = "";

  static styles = css`
    :host {
      display: block;
      border-top: 1px solid var(--wq-border, #30363d);
      padding: 12px 16px;
      background: var(--wq-bg-primary, #0d1117);
    }

    .input-row {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }

    textarea {
      flex: 1;
      resize: none;
      padding: 10px 12px;
      border: 1px solid var(--wq-border, #30363d);
      border-radius: 8px;
      background: var(--wq-bg-input, #0d1117);
      color: var(--wq-text-primary, #e0e0e0);
      font-size: 14px;
      line-height: 1.5;
      font-family: inherit;
      max-height: 200px;
      overflow-y: auto;
      box-sizing: border-box;
      transition: border-color 0.15s;
    }

    textarea:focus {
      outline: none;
      border-color: var(--wq-accent, #667eea);
    }

    textarea::placeholder {
      color: var(--wq-text-secondary, #555);
    }

    .send-btn {
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 8px;
      background: var(--wq-accent, #667eea);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s, opacity 0.15s;
    }

    .send-btn:hover:not(:disabled) {
      background: var(--wq-accent-hover, #5a6fd6);
    }

    .send-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    .send-icon {
      font-size: 18px;
      line-height: 1;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;

  private handleInput(e: Event): void {
    const ta = e.target as HTMLTextAreaElement;
    this._value = ta.value;
    // 自适应高度
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  private send(): void {
    const text = this._value.trim();
    if (!text || this.sending || this.disabled) return;

    this.dispatchEvent(
      new CustomEvent(WARRENQ_EVENTS.SEND_MESSAGE, {
        detail: { content: text },
        bubbles: true,
        composed: true,
      }),
    );

    this._value = "";
    // 重置 textarea 高度
    const ta = this.shadowRoot?.querySelector("textarea");
    if (ta) ta.style.height = "auto";
  }

  render() {
    const canSend = this._value.trim().length > 0 && !this.sending && !this.disabled;

    return html`
      <div class="input-row">
        <textarea
          .value=${this._value}
          @input=${this.handleInput}
          @keydown=${this.handleKeydown}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          ?disabled=${this.disabled || this.sending}
          rows="1"
        ></textarea>
        <button
          class="send-btn"
          ?disabled=${!canSend}
          @click=${this.send}
          aria-label="发送"
        >
          ${this.sending
            ? html`<span class="spinner"></span>`
            : html`<span class="send-icon">&#10148;</span>`}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "warrenq-chat-input": WarrenqChatInput;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add ui/src/ui/views/warrenq-chat-input.ts
git commit -m "feat(warrenq): add chat input component with auto-resize textarea"
```

---

### Task 4: 创建侧边栏组件

**Files:**
- Create: `ui/src/ui/views/warrenq-chat-sidebar.ts`

- [ ] **Step 1: 实现侧边栏组件**

```typescript
// ui/src/ui/views/warrenq-chat-sidebar.ts

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { WarrenqSession } from "./warrenq-chat.types.js";
import { WARRENQ_EVENTS } from "./warrenq-chat.types.js";

@customElement("warrenq-sidebar")
export class WarrenqSidebar extends LitElement {
  @property({ type: Array })
  sessions: WarrenqSession[] = [];

  @property({ type: String })
  activeSessionKey = "";

  @property({ type: Boolean })
  connected = false;

  @state()
  private _searchQuery = "";

  @state()
  private _collapsed = false;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 240px;
      min-width: 240px;
      background: var(--wq-bg-sidebar, #161b22);
      border-right: 1px solid var(--wq-border, #30363d);
      height: 100%;
      overflow: hidden;
      transition: width 0.2s, min-width 0.2s;
    }

    :host([collapsed]) {
      width: 64px;
      min-width: 64px;
    }

    .sidebar-header {
      padding: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--wq-border, #30363d);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .brand-logo {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: var(--wq-accent, #667eea);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }

    .brand-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--wq-text-primary, #e0e0e0);
      white-space: nowrap;
    }

    :host([collapsed]) .brand-name,
    :host([collapsed]) .collapse-label {
      display: none;
    }

    .collapse-btn {
      background: none;
      border: none;
      color: var(--wq-text-secondary, #888);
      cursor: pointer;
      padding: 4px;
      font-size: 16px;
    }

    .collapse-btn:hover {
      color: var(--wq-text-primary, #e0e0e0);
    }

    .new-chat-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 8px 12px;
      padding: 8px 12px;
      border: 1px dashed var(--wq-border, #30363d);
      border-radius: 8px;
      background: transparent;
      color: var(--wq-text-primary, #e0e0e0);
      font-size: 13px;
      cursor: pointer;
      width: calc(100% - 24px);
      transition: border-color 0.15s;
    }

    .new-chat-btn:hover {
      border-color: var(--wq-accent, #667eea);
    }

    :host([collapsed]) .new-chat-btn span {
      display: none;
    }

    .search-box {
      margin: 4px 12px 8px;
    }

    .search-box input {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid var(--wq-border, #30363d);
      border-radius: 6px;
      background: var(--wq-bg-input, #0d1117);
      color: var(--wq-text-primary, #e0e0e0);
      font-size: 12px;
      box-sizing: border-box;
    }

    .search-box input::placeholder {
      color: var(--wq-text-secondary, #555);
    }

    .search-box input:focus {
      outline: none;
      border-color: var(--wq-accent, #667eea);
    }

    :host([collapsed]) .search-box {
      display: none;
    }

    .session-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 8px;
    }

    .session-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: var(--wq-text-primary, #e0e0e0);
      transition: background 0.12s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .session-item:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .session-item--active {
      background: rgba(102, 126, 234, 0.15);
      color: var(--wq-accent, #667eea);
    }

    .session-item-icon {
      flex-shrink: 0;
      font-size: 14px;
    }

    :host([collapsed]) .session-item span {
      display: none;
    }

    :host([collapsed]) .session-item {
      justify-content: center;
      padding: 8px;
    }

    .status-bar {
      padding: 8px 12px;
      border-top: 1px solid var(--wq-border, #30363d);
      font-size: 11px;
      color: var(--wq-text-secondary, #888);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .status-dot--connected {
      background: #34d399;
    }

    .status-dot--disconnected {
      background: #f87171;
    }

    :host([collapsed]) .status-bar span {
      display: none;
    }
  `;

  private get filteredSessions(): WarrenqSession[] {
    if (!this._searchQuery.trim()) return this.sessions;
    const q = this._searchQuery.toLowerCase();
    return this.sessions.filter((s) => s.title.toLowerCase().includes(q));
  }

  private handleNewChat(): void {
    this.dispatchEvent(
      new CustomEvent(WARRENQ_EVENTS.NEW_SESSION, {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleSwitchSession(key: string): void {
    this.dispatchEvent(
      new CustomEvent(WARRENQ_EVENTS.SWITCH_SESSION, {
        detail: { sessionKey: key },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleSearchInput(e: Event): void {
    this._searchQuery = (e.target as HTMLInputElement).value;
  }

  private toggleCollapsed(): void {
    this._collapsed = !this._collapsed;
    if (this._collapsed) {
      this.setAttribute("collapsed", "");
    } else {
      this.removeAttribute("collapsed");
    }
  }

  render() {
    const sessions = this.filteredSessions;

    return html`
      <div class="sidebar-header">
        <div class="brand">
          <div class="brand-logo">&#x1F990;</div>
          <span class="brand-name">综合助手</span>
        </div>
        <button class="collapse-btn" @click=${this.toggleCollapsed} aria-label="折叠侧边栏">
          ${this._collapsed ? "&#x25B6;" : "&#x25C0;"}
        </button>
      </div>

      <button class="new-chat-btn" @click=${this.handleNewChat}>
        <span>+&nbsp;新建对话</span>
      </button>

      <div class="search-box">
        <input
          type="text"
          placeholder="搜索对话..."
          .value=${this._searchQuery}
          @input=${this.handleSearchInput}
        />
      </div>

      <div class="session-list">
        ${sessions.map(
          (s) => html`
            <div
              class="session-item ${s.key === this.activeSessionKey ? "session-item--active" : ""}"
              @click=${() => this.handleSwitchSession(s.key)}
            >
              <span class="session-item-icon">&#x1F4AC;</span>
              <span>${s.title}</span>
            </div>
          `,
        )}
      </div>

      <div class="status-bar">
        <span class="status-dot ${this.connected ? "status-dot--connected" : "status-dot--disconnected"}"></span>
        <span>${this.connected ? "已连接" : "未连接"}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "warrenq-sidebar": WarrenqSidebar;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add ui/src/ui/views/warrenq-chat-sidebar.ts
git commit -m "feat(warrenq): add sidebar component with session list and search"
```

---

### Task 5: 创建主聊天区域组件

**Files:**
- Create: `ui/src/ui/views/warrenq-chat-main.ts`

- [ ] **Step 1: 实现主聊天区域组件**

```typescript
// ui/src/ui/views/warrenq-chat-main.ts

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { ref } from "lit/directives/ref.js";
import type { WarrenqMessage } from "./warrenq-chat.types.js";
import "./warrenq-chat-message.js";
import "./warrenq-chat-input.js";

@customElement("warrenq-chat-main")
export class WarrenqChatMain extends LitElement {
  @property({ type: Array })
  messages: WarrenqMessage[] = [];

  @property({ type: String })
  stream: string | null = null;

  @property({ type: String })
  sessionTitle = "";

  @property({ type: Boolean })
  sending = false;

  @property({ type: Boolean })
  connected = false;

  @property({ type: Boolean })
  loading = false;

  private _messagesContainer?: HTMLDivElement;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      background: var(--wq-bg-primary, #0d1117);
      height: 100%;
    }

    .chat-header {
      padding: 12px 20px;
      border-bottom: 1px solid var(--wq-border, #30363d);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .chat-header-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--wq-text-primary, #e0e0e0);
    }

    .chat-header-status {
      font-size: 12px;
      color: var(--wq-text-secondary, #888);
      margin-left: auto;
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--wq-text-secondary, #888);
      gap: 12px;
    }

    .empty-state-icon {
      font-size: 48px;
    }

    .empty-state-text {
      font-size: 14px;
    }

    .stream-bubble {
      padding: 10px 14px;
      border-radius: 12px;
      border-bottom-left-radius: 4px;
      background: var(--wq-assistant-bubble, #1e1e2e);
      border: 1px solid var(--wq-border, #30363d);
      font-size: 14px;
      line-height: 1.6;
      color: var(--wq-text-primary, #e0e0e0);
      max-width: 80%;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      padding: 16px;
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid var(--wq-border, #30363d);
      border-top-color: var(--wq-accent, #667eea);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;

  private _scrollRef(el?: HTMLDivElement): void {
    if (el) this._messagesContainer = el;
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has("messages") || changed.has("stream")) {
      this._scrollToBottom();
    }
  }

  private _scrollToBottom(): void {
    requestAnimationFrame(() => {
      if (this._messagesContainer) {
        this._messagesContainer.scrollTop = this._messagesContainer.scrollHeight;
      }
    });
  }

  render() {
    return html`
      <div class="chat-header">
        <span class="chat-header-title">${this.sessionTitle || "综合助手小龙虾"}</span>
        <span class="chat-header-status">${this.connected ? "" : "连接中..."}</span>
      </div>

      <div class="messages-container" ${ref(this._scrollRef)}>
        ${this.messages.length === 0 && !this.loading
          ? html`
            <div class="empty-state">
              <div class="empty-state-icon">&#x1F990;</div>
              <div class="empty-state-text">开始新的对话吧</div>
            </div>
          `
          : nothing}

        ${this.loading
          ? html`<div class="loading-spinner"><div class="spinner"></div></div>`
          : nothing}

        ${repeat(
          this.messages,
          (m) => m.id,
          (m) => html`<warrenq-chat-message .message=${m}></warrenq-chat-message>`,
        )}

        ${this.stream
          ? html`<div class="stream-bubble">${this.stream}</div>`
          : nothing}
      </div>

      <warrenq-chat-input
        .sending=${this.sending}
        .disabled=${!this.connected}
      ></warrenq-chat-input>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "warrenq-chat-main": WarrenqChatMain;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add ui/src/ui/views/warrenq-chat-main.ts
git commit -m "feat(warrenq): add chat main area component with message stream"
```

---

### Task 6: 创建页面组合器组件

**Files:**
- Create: `ui/src/ui/views/warrenq-chat-page.ts`

- [ ] **Step 1: 实现页面组合器**

这是核心组件，持有 WebSocket 连接和所有状态，协调子组件交互。

```typescript
// ui/src/ui/views/warrenq-chat-page.ts

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { normalizeBasePath } from "../navigation.js";
import type { WarrenqSession, WarrenqMessage } from "./warrenq-chat.types.js";
import { WARRENQ_EVENTS } from "./warrenq-chat.types.js";
import "./warrenq-sidebar.js";
import "./warrenq-chat-main.js";

@customElement("warrenq-chat-page")
export class WarrenqChatPage extends LitElement {
  @property({ type: String })
  basePath = "";

  @state()
  private _sessions: WarrenqSession[] = [];

  @state()
  private _activeSessionKey = "";

  @state()
  private _messages: WarrenqMessage[] = [];

  @state()
  private _connected = false;

  @state()
  private _sending = false;

  @state()
  private _stream: string | null = null;

  @state()
  private _loading = false;

  private _ws: WebSocket | null = null;
  private _reconnectAttempts = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _messageIdCounter = 0;

  static styles = css`
    :host {
      display: flex;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--wq-bg-primary, #0d1117);
      color: var(--wq-text-primary, #e0e0e0);
    }

    .reconnect-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      padding: 8px;
      background: rgba(245, 158, 11, 0.15);
      border-bottom: 1px solid rgba(245, 158, 11, 0.3);
      color: #fbbf24;
      text-align: center;
      font-size: 13px;
      z-index: 100;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadSessions();
    this._connectWebSocket();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._disconnectWebSocket();
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
  }

  private _getApiUrl(path: string): string {
    const bp = normalizeBasePath(this.basePath);
    return bp ? `${bp}${path}` : path;
  }

  private _nextMessageId(): string {
    this._messageIdCounter++;
    return `msg_${Date.now()}_${this._messageIdCounter}`;
  }

  // --- 会话管理 ---

  private async _loadSessions(): Promise<void> {
    try {
      const res = await fetch(this._getApiUrl("/api/sessions"), { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        this._sessions = Array.isArray(data) ? data : (data.sessions ?? []);
        // 如果没有活跃会话，选择第一个
        if (!this._activeSessionKey && this._sessions.length > 0) {
          this._switchToSession(this._sessions[0].key);
        }
      }
    } catch {
      // 静默处理，侧边栏显示为空
    }
  }

  private async _createNewSession(): Promise<void> {
    try {
      const res = await fetch(this._getApiUrl("/api/sessions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ title: "新对话" }),
      });
      if (res.ok) {
        const session = await res.json();
        this._sessions = [session, ...this._sessions];
        this._switchToSession(session.key);
      }
    } catch {
      // 静默处理
    }
  }

  private async _switchToSession(key: string): Promise<void> {
    this._activeSessionKey = key;
    this._messages = [];
    this._stream = null;
    this._loading = true;

    try {
      const res = await fetch(this._getApiUrl(`/api/chat/${encodeURIComponent(key)}`), {
        credentials: "same-origin",
      });
      if (res.ok) {
        this._messages = await res.json();
      }
    } catch {
      // 静默处理
    } finally {
      this._loading = false;
    }
  }

  // --- WebSocket ---

  private _connectWebSocket(): void {
    if (this._ws?.readyState === WebSocket.OPEN) return;

    const bp = normalizeBasePath(this.basePath);
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsBase = bp ? `${wsProtocol}//${window.location.host}${bp}` : `${wsProtocol}//${window.location.host}`;
    const wsUrl = `${wsBase}/api/chat/ws?session=${encodeURIComponent(this._activeSessionKey)}`;

    try {
      this._ws = new WebSocket(wsUrl);

      this._ws.onopen = () => {
        this._connected = true;
        this._reconnectAttempts = 0;
      };

      this._ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this._handleWebSocketMessage(data);
        } catch {
          // 非JSON消息，作为纯文本流处理
          if (typeof event.data === "string") {
            this._stream = (this._stream ?? "") + event.data;
          }
        }
      };

      this._ws.onclose = () => {
        this._connected = false;
        this._scheduleReconnect();
      };

      this._ws.onerror = () => {
        this._connected = false;
      };
    } catch {
      this._scheduleReconnect();
    }
  }

  private _disconnectWebSocket(): void {
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.onerror = null;
      this._ws.close();
      this._ws = null;
    }
    this._connected = false;
  }

  private _scheduleReconnect(): void {
    if (this._reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30000);
    this._reconnectAttempts++;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connectWebSocket();
    }, delay);
  }

  private _handleWebSocketMessage(data: { type?: string; content?: string; id?: string; role?: string }): void {
    if (data.type === "stream" && data.content) {
      this._stream = (this._stream ?? "") + data.content;
    } else if (data.type === "message" || data.role) {
      // 完整消息
      this._stream = null;
      this._messages = [
        ...this._messages,
        {
          id: data.id ?? this._nextMessageId(),
          role: data.role ?? "assistant",
          content: data.content ?? "",
          timestamp: Date.now(),
        },
      ];
      this._sending = false;
    } else if (data.type === "error") {
      this._sending = false;
      this._stream = null;
      // 标记最后一条用户消息为失败
      this._markLastUserMessageFailed();
    }
  }

  private _markLastUserMessageFailed(): void {
    const msgs = [...this._messages];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") {
        msgs[i] = { ...msgs[i], failed: true };
        break;
      }
    }
    this._messages = msgs;
  }

  // --- 消息发送 ---

  private async _sendMessage(content: string): Promise<void> {
    // 添加用户消息到列表
    const userMsg: WarrenqMessage = {
      id: this._nextMessageId(),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    this._messages = [...this._messages, userMsg];
    this._sending = true;
    this._stream = null;

    // 通过 WebSocket 发送
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({
        type: "message",
        content,
        sessionKey: this._activeSessionKey,
      }));
    } else {
      // WebSocket 未连接，回退到 HTTP POST
      try {
        const res = await fetch(this._getApiUrl("/api/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            sessionKey: this._activeSessionKey,
            content,
          }),
        });
        if (res.ok) {
          const assistantMsg = await res.json();
          this._messages = [
            ...this._messages,
            {
              id: assistantMsg.id ?? this._nextMessageId(),
              role: "assistant",
              content: assistantMsg.content ?? assistantMsg.message ?? "",
              timestamp: Date.now(),
            },
          ];
        } else {
          this._markLastUserMessageFailed();
        }
      } catch {
        this._markLastUserMessageFailed();
      } finally {
        this._sending = false;
      }
    }
  }

  // --- 事件处理 ---

  private _handleNewSession(): void {
    this._createNewSession();
  }

  private _handleSwitchSession(e: CustomEvent<{ sessionKey: string }>): void {
    this._switchToSession(e.detail.sessionKey);
  }

  private _handleSendMessage(e: CustomEvent<{ content: string }>): void {
    this._sendMessage(e.detail.content);
  }

  private _handleRetryMessage(e: CustomEvent<{ messageId: string }>): void {
    const msg = this._messages.find((m) => m.id === e.detail.messageId);
    if (msg?.content) {
      // 移除失败消息，重新发送
      this._messages = this._messages.filter((m) => m.id !== e.detail.messageId);
      this._sendMessage(msg.content);
    }
  }

  render() {
    const activeSession = this._sessions.find((s) => s.key === this._activeSessionKey);

    return html`
      ${!this._connected && this._reconnectAttempts > 0
        ? html`<div class="reconnect-banner">连接断开，正在重连... (${this._reconnectAttempts})</div>`
        : ""}

      <warrenq-sidebar
        .sessions=${this._sessions}
        .activeSessionKey=${this._activeSessionKey}
        .connected=${this._connected}
        @${WARRENQ_EVENTS.NEW_SESSION}=${this._handleNewSession}
        @${WARRENQ_EVENTS.SWITCH_SESSION}=${this._handleSwitchSession}
      ></warrenq-sidebar>

      <warrenq-chat-main
        .messages=${this._messages}
        .stream=${this._stream}
        .sessionTitle=${activeSession?.title ?? ""}
        .sending=${this._sending}
        .connected=${this._connected}
        .loading=${this._loading}
        @${WARRENQ_EVENTS.SEND_MESSAGE}=${this._handleSendMessage}
        @${WARRENQ_EVENTS.RETRY_MESSAGE}=${this._handleRetryMessage}
      ></warrenq-chat-main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "warrenq-chat-page": WarrenqChatPage;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add ui/src/ui/views/warrenq-chat-page.ts
git commit -m "feat(warrenq): add chat page orchestrator with WebSocket and state management"
```

---

### Task 7: 创建独立入口和 HTML 页面

**Files:**
- Create: `ui/src/warrenq-chat-entry.ts`
- Create: `ui/warrenq-chat.html`

- [ ] **Step 1: 创建入口 TS 文件**

```typescript
// ui/src/warrenq-chat-entry.ts

import "./ui/views/warrenq-chat-page.js";

// 从 URL query params 或 meta 标签获取 basePath
const metaBase = document.querySelector('meta[name="openclaw-base-path"]')?.getAttribute("content") ?? "";
const basePath = metaBase || new URLSearchParams(window.location.search).get("basePath") || "";

// 挂载页面组件
const container = document.getElementById("app");
if (container) {
  const page = document.createElement("warrenq-chat-page");
  page.basePath = basePath;
  container.appendChild(page);
}
```

- [ ] **Step 2: 创建 HTML 页面**

```html
<!-- ui/warrenq-chat.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>综合助手小龙虾</title>
  <meta name="openclaw-base-path" content="__OPENCLAW_BASE_PATH__" />
  <style>
    :root {
      --wq-bg-primary: #0d1117;
      --wq-bg-sidebar: #161b22;
      --wq-bg-card: #1a1a2e;
      --wq-bg-input: #0d1117;
      --wq-border: #30363d;
      --wq-text-primary: #e0e0e0;
      --wq-text-secondary: #888;
      --wq-accent: #667eea;
      --wq-accent-hover: #5a6fd6;
      --wq-user-bubble: #2d5aa0;
      --wq-assistant-bubble: #1e1e2e;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body {
      background: var(--wq-bg-primary);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #app { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./src/warrenq-chat-entry.ts"></script>
</body>
</html>
```

- [ ] **Step 3: 提交**

```bash
git add ui/src/warrenq-chat-entry.ts ui/warrenq-chat.html
git commit -m "feat(warrenq): add standalone entry point and HTML page for chat"
```

---

### Task 8: 配置 Vite 多页面构建

**Files:**
- Modify: `ui/vite.config.ts`

- [ ] **Step 1: 修改 Vite 配置，添加 warrenq-chat 页面**

在 `ui/vite.config.ts` 的 `return {}` 中添加 `build.input` 配置：

```typescript
// 在 defineConfig 回调中，build 对象内添加：
build: {
  outDir: path.resolve(here, "../dist/control-ui"),
  emptyOutDir: true,
  sourcemap: true,
  chunkSizeWarningLimit: 1024,
  // 新增：多页面入口
  rollupOptions: {
    input: {
      main: path.resolve(here, "index.html"),
      "warrenq-chat": path.resolve(here, "warrenq-chat.html"),
    },
  },
},
```

完整修改后的文件关键部分：

```typescript
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

function normalizeBase(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "/";
  if (trimmed === "./") return "./";
  if (trimmed.endsWith("/")) return trimmed;
  return `${trimmed}/`;
}

export default defineConfig(() => {
  const envBase = process.env.OPENCLAW_CONTROL_UI_BASE_PATH?.trim();
  const base = envBase ? normalizeBase(envBase) : "./";
  return {
    base,
    publicDir: path.resolve(here, "public"),
    optimizeDeps: {
      include: ["lit/directives/repeat.js"],
    },
    build: {
      outDir: path.resolve(here, "../dist/control-ui"),
      emptyOutDir: true,
      sourcemap: true,
      chunkSizeWarningLimit: 1024,
      rollupOptions: {
        input: {
          main: path.resolve(here, "index.html"),
          "warrenq-chat": path.resolve(here, "warrenq-chat.html"),
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
    },
    plugins: [
      {
        name: "control-ui-dev-stubs",
        configureServer(server) {
          server.middlewares.use("/__openclaw/control-ui-config.json", (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                basePath: "/",
                assistantName: "",
                assistantAvatar: "",
              }),
            );
          });
        },
      },
    ],
  };
});
```

- [ ] **Step 2: 验证构建**

Run: `cd /Volumes/Data/Project/StudyPro/AiPro/openclaw && pnpm --filter ui build 2>&1 | tail -10`
Expected: 构建成功，输出包含 `warrenq-chat.html`

- [ ] **Step 3: 提交**

```bash
git add ui/vite.config.ts
git commit -m "feat(warrenq): configure Vite multi-page build for warrenq-chat"
```

---

### Task 9: 创建后端路由

**Files:**
- Create: `extensions/gildata/src/warrenq-chat-route.ts`
- Modify: `extensions/gildata/src/index.ts`

- [ ] **Step 1: 创建后端路由处理器**

```typescript
// extensions/gildata/src/warrenq-chat-route.ts

import type { IncomingMessage, ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { logger } from "./logger.js";

/**
 * GET /plugins/gildata/warrenq-chat 路由处理器
 *
 * 返回独立的综合助手聊天 HTML 页面。
 * 将 __OPENCLAW_BASE_PATH__ 替换为实际的 basePath。
 */
export async function handleWarrenqChatRoute(
  req: IncomingMessage,
  res: ServerResponse,
  basePath: string,
): Promise<boolean> {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.end("Method Not Allowed");
    return true;
  }

  try {
    // 构建构建产物的路径
    const distPath = path.resolve(process.cwd(), "dist/control-ui/warrenq-chat.html");

    let html: string;
    try {
      html = await fs.readFile(distPath, "utf-8");
    } catch {
      // 如果构建产物不存在，返回开发模式提示
      res.statusCode = 503;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"><title>综合助手</title></head>
        <body style="background:#0d1117;color:#e0e0e0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
          <div style="text-align:center">
            <h2>综合助手小龙虾</h2>
            <p>聊天页面正在构建中，请运行 <code>pnpm --filter ui build</code></p>
          </div>
        </body></html>
      `);
      return true;
    }

    // 替换 basePath 占位符
    const bp = basePath || "";
    html = html.replace(/__OPENCLAW_BASE_PATH__/g, bp);

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.end(html);
    return true;
  } catch (error) {
    logger.error("提供聊天页面失败", error as Error);
    res.statusCode = 500;
    res.end("Internal Server Error");
    return true;
  }
}
```

- [ ] **Step 2: 在插件 index.ts 中注册路由**

在 `extensions/gildata/src/index.ts` 的 `register(api)` 方法中，现有 `registerHttpRoute` 之后添加：

```typescript
// 注册 Warrenq 聊天页面 GET 路由
api.registerHttpRoute({
  path: "/plugins/gildata/warrenq-chat",
  handler: async (req, res) => {
    const { handleWarrenqChatRoute } = await import("./warrenq-chat-route.js");
    // 从请求路径中推导 basePath
    const urlPath = req.url ?? "/";
    const bp = urlPath.endsWith("/warrenq-chat")
      ? urlPath.replace(/\/warrenq-chat$/, "")
      : "";
    return handleWarrenqChatRoute(req, res, bp);
  },
  auth: "plugin",
});
```

- [ ] **Step 3: 提交**

```bash
git add extensions/gildata/src/warrenq-chat-route.ts extensions/gildata/src/index.ts
git commit -m "feat(warrenq): add backend route to serve standalone chat page"
```

---

### Task 10: 更新登录跳转

**Files:**
- Modify: `ui/src/ui/views/warrenq-login.ts`

- [ ] **Step 1: 修改登录成功后的跳转目标**

在 `warrenq-login.ts` 的 `performLogin` 方法中，将登录成功后的跳转 URL 从 `/chat` 改为 `/warrenq-chat`。

找到以下代码（约第 276-278 行）：

```typescript
// 登录成功后延迟跳转到聊天页面
setTimeout(() => {
  const bp = normalizeBasePath(this.basePath);
  const chatUrl = bp ? `${bp}/chat` : "/chat";
  window.location.href = chatUrl;
}, 1500);
```

替换为：

```typescript
// 登录成功后延迟跳转到综合助手聊天页面
setTimeout(() => {
  const bp = normalizeBasePath(this.basePath);
  const chatUrl = bp ? `${bp}/plugins/gildata/warrenq-chat` : "/plugins/gildata/warrenq-chat";
  window.location.href = chatUrl;
}, 1500);
```

- [ ] **Step 2: 提交**

```bash
git add ui/src/ui/views/warrenq-login.ts
git commit -m "feat(warrenq): redirect to standalone chat page after login"
```

---

### Task 11: 构建验证与集成测试

**Files:** 无新文件

- [ ] **Step 1: 运行类型检查**

Run: `cd /Volumes/Data/Project/StudyPro/AiPro/openclaw && pnpm tsgo 2>&1 | tail -20`
Expected: 无类型错误（或仅有已存在的错误）

- [ ] **Step 2: 运行 lint 检查**

Run: `cd /Volumes/Data/Project/StudyPro/AiPro/openclaw && pnpm check 2>&1 | tail -20`
Expected: 无新增 lint 错误

- [ ] **Step 3: 构建 UI**

Run: `cd /Volumes/Data/Project/StudyPro/AiPro/openclaw && pnpm --filter ui build 2>&1 | tail -15`
Expected: 构建成功，输出包含 `warrenq-chat.html`

- [ ] **Step 4: 验证构建产物**

Run: `ls -la /Volumes/Data/Project/StudyPro/AiPro/openclaw/dist/control-ui/warrenq-chat.html 2>&1`
Expected: 文件存在

- [ ] **Step 5: 运行现有测试确保无回归**

Run: `cd /Volumes/Data/Project/StudyPro/AiPro/openclaw && pnpm test extensions/gildata/ 2>&1 | tail -20`
Expected: 所有现有测试通过

---

## Self-Review

**Spec coverage:**
- 组件架构: Task 1-6 覆盖所有组件
- 数据流: Task 6 覆盖 WebSocket、事件、状态管理
- 路由与入口: Task 7-9 覆盖 HTML 入口、Vite 配置、后端路由
- 样式: 每个组件的 `static styles` 中包含完整 CSS
- 错误处理: Task 6 包含重连、失败标记、HTTP 回退
- 登录跳转: Task 10 覆盖

**Placeholder scan:** 无 TBD/TODO/实现后补充

**Type consistency:** 所有组件使用 `WarrenqSession`、`WarrenqMessage`、`WARRENQ_EVENTS` 一致引用自 `warrenq-chat.types.ts`
