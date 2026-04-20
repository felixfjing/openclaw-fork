# 技能管理页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Figma 设计稿（node-id=366-54571）中的技能管理页面，包含卡片网格布局、Tab 切换、搜索、添加下拉菜单和开关交互。

**Architecture:** 采用与 cron 页面一致的 hash 路由模式（`#skills`），复用现有 sidebar 布局，通过 `skills.status` API 获取数据并扩展前端 fallback 逻辑。页面渲染使用 Lit html 模板。

**Tech Stack:** TypeScript, Lit (lit-html), CSS Grid, Hash Routing

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `ui/src/ui/views/chat-standalone/state.ts` | Modify | 新增 `SkillCardEntry` 类型和技能页面状态 |
| `ui/src/ui/views/chat-standalone/skills-page.ts` | Create | 技能页面主渲染逻辑（header + grid + card + dropdown） |
| `ui/src/ui/views/chat-standalone.ts` | Modify | 新增 `#skills` hash 路由 |
| `ui/src/styles/chat-standalone.css` | Modify | 新增技能页面 CSS 样式 |

---

### Task 1: 扩展 state.ts — 新增 SkillCardEntry 类型和状态

**Files:**
- Modify: `ui/src/ui/views/chat-standalone/state.ts`

- [ ] **Step 1: 在 `SkillDropdownEntry` 之后新增 `SkillCardEntry` 接口**

在 `state.ts` 的 `SkillDropdownEntry` 接口之后（约第 13 行）添加：

```typescript
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
```

- [ ] **Step 2: 在 `ChatEphemeralState` 接口中新增技能页面状态字段**

在 `ChatEphemeralState` 接口中，`skillsSearchQuery` 之后添加：

```typescript
  skillsTab: "my" | "market";
  skillsPageSearchQuery: string;
  skillsAddDropdownOpen: boolean;
```

- [ ] **Step 3: 在 `createChatEphemeralState()` 中初始化新字段**

在 `createChatEphemeralState()` 函数中，`skillsSearchQuery: ""` 之后添加：

```typescript
    skillsTab: "my",
    skillsPageSearchQuery: "",
    skillsAddDropdownOpen: false,
```

- [ ] **Step 4: 新增 `loadSkillsCardList` 函数**

在 `loadSkillsList` 函数之后，添加新的加载函数用于技能页面卡片数据：

```typescript
export async function loadSkillsCardList(client: { request: (method: string, params: Record<string, unknown>) => Promise<unknown> }): Promise<void> {
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
```

注意：此处复用了 `chatViewState.skillsList`，但 `SkillCardEntry` 是 `SkillDropdownEntry` 的超集。后续需要将 `skillsList` 的类型改为 `SkillCardEntry[]`。

- [ ] **Step 5: 更新 `SkillDropdownEntry` 和 `skillsList` 类型**

将 `SkillDropdownEntry` 更新为包含 `enabled` 等可选字段，并将 `skillsList` 类型改为 `SkillCardEntry[]`：

```typescript
export interface SkillDropdownEntry {
  name: string;
  skillKey: string;
  emoji?: string;
  description: string;
  enabled?: boolean;
  iconChar?: string;
  iconColor?: string;
  tags?: string[];
  status?: "idle" | "updating" | "update_available";
  avatarUrl?: string;
}
```

同时更新 `ChatEphemeralState` 中的 `skillsList` 类型：

```typescript
skillsList: SkillCardEntry[];
```

- [ ] **Step 6: 运行类型检查验证**

Run: `cd /Volumes/Data/Project/StudyPro/AiPro/openclaw && pnpm tsgo 2>&1 | head -30`
Expected: 无类型错误（或仅有与 skillsList 兼容性相关的错误，会在后续步骤修复）

---

### Task 2: 创建 skills-page.ts — 页面渲染

**Files:**
- Create: `ui/src/ui/views/chat-standalone/skills-page.ts`

- [ ] **Step 1: 创建文件，写入完整的技能页面渲染逻辑**

```typescript
import { html, nothing, type TemplateResult } from "lit";
import { icons } from "../../icons.ts";
import type { ChatProps } from "./types.ts";
import { chatViewState, type SkillCardEntry } from "./state.ts";

type SkillsTab = "my" | "market";

function filterSkills(
  skills: SkillCardEntry[],
  query: string,
): SkillCardEntry[] {
  if (!query.trim()) return skills;
  const q = query.toLowerCase();
  return skills.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

function renderSidebar(): TemplateResult {
  const items = [
    { key: "home", label: "综合助手", icon: icons.messageSquare },
    { key: "cron", label: "定时任务", icon: icons.alarm },
    { key: "skills", label: "技能广场", icon: icons.wrench },
    { key: "experts", label: "专家Agent", icon: icons.graduationCap },
    { key: "docs", label: "文档中心", icon: icons.fileText },
  ];

  return html`
    <nav class="cron-page__sidebar">
      <div class="cron-page__sidebar-main">
        ${items.map(
          (item) => html`
            <div
              class="cron-page__sidebar-item ${item.key === "skills" ? "cron-page__sidebar-item--active" : ""}"
              title=${item.label}
              @click=${() => {
                if (item.key === "home") {
                  window.location.hash = "";
                } else if (item.key === "cron") {
                  window.location.hash = "#cron";
                } else if (item.key === "skills") {
                  window.location.hash = "#skills";
                }
              }}
            >
              <span class="cron-page__sidebar-icon">${item.icon}</span>
              <span class="cron-page__sidebar-label">${item.label}</span>
            </div>
          `,
        )}
      </div>
    </nav>
  `;
}

function renderTabBar(): TemplateResult {
  return html`
    <div class="cron-page__tabbar">
      <div class="cron-page__tabs">
        <div
          class="cron-page__tab"
          @click=${() => {
            window.location.hash = "";
          }}
        >
          <span class="cron-page__tab-text">综合助手</span>
        </div>
        <div class="cron-page__tab cron-page__tab--active">
          <span class="cron-page__tab-icon">${icons.wrench}</span>
          <span class="cron-page__tab-text">技能管理</span>
          <span
            class="cron-page__tab-close"
            @click=${() => {
              window.location.hash = "";
            }}
          >${icons.x}</span>
        </div>
      </div>
      <div class="cron-page__tabbar-actions">
        <span class="cron-page__tabbar-btn" title="刷新" @click=${() => window.location.reload()}>${icons.refresh}</span>
      </div>
    </div>
  `;
}

function renderSkillsHeader(
  tab: SkillsTab,
  onTabChange: (tab: SkillsTab) => void,
  searchQuery: string,
  onSearchChange: (query: string) => void,
  dropdownOpen: boolean,
  onToggleDropdown: () => void,
  requestUpdate: () => void,
): TemplateResult {
  return html`
    <div class="skills-header">
      <div class="skills-header__left">
        <div
          class="skills-header__tab ${tab === "my" ? "skills-header__tab--active" : ""}"
          @click=${() => onTabChange("my")}
        >
          <span class="skills-header__tab-text">我的技能</span>
        </div>
        <div
          class="skills-header__tab ${tab === "market" ? "skills-header__tab--active" : ""}"
          @click=${() => onTabChange("market")}
        >
          <span class="skills-header__tab-text">技能广场</span>
        </div>
      </div>
      <div class="skills-header__right">
        <label class="skills-header__search">
          <span class="skills-header__search-icon">${icons.search}</span>
          <input
            type="search"
            placeholder="搜索技能名称"
            .value=${searchQuery}
            @input=${(e: Event) =>
              onSearchChange((e.target as HTMLInputElement).value)}
          />
        </label>
        <div class="skills-header__add-wrap">
          <button
            class="skills-header__add-btn"
            @click=${onToggleDropdown}
          >
            <span class="skills-header__add-icon">${icons.plus}</span>
            <span class="skills-header__add-text">添加</span>
            <span class="skills-header__add-arrow">${icons.caretDownFill}</span>
          </button>
          ${dropdownOpen
            ? html`
                <div class="skills-header__add-backdrop" @click=${onToggleDropdown}></div>
                <div class="skills-header__dropdown">
                  <div class="skills-header__dropdown-item" @click=${() => { onTabChange("market"); onToggleDropdown(); requestUpdate(); }}>
                    <span class="skills-header__dropdown-icon">${icons.search}</span>
                    <span>查找技能</span>
                  </div>
                  <div class="skills-header__dropdown-item" @click=${onToggleDropdown}>
                    <span class="skills-header__dropdown-icon">${icons.upload}</span>
                    <span>上传技能</span>
                  </div>
                  <div class="skills-header__dropdown-item" @click=${onToggleDropdown}>
                    <span class="skills-header__dropdown-icon">${icons.plus}</span>
                    <span>创建技能</span>
                  </div>
                </div>
              `
            : nothing}
        </div>
      </div>
    </div>
  `;
}

function renderSkillIcon(skill: SkillCardEntry): TemplateResult {
  if (skill.avatarUrl) {
    return html`
      <div class="skill-card__icon skill-card__icon--image">
        <img src=${skill.avatarUrl} alt=${skill.name} />
      </div>
    `;
  }
  const bgColor = skill.enabled ? skill.iconColor : "#c5c7c9";
  return html`
    <div class="skill-card__icon" style="background:${bgColor}">
      <span class="skill-card__icon-char">${skill.iconChar}</span>
    </div>
  `;
}

function renderSkillStatus(skill: SkillCardEntry): TemplateResult | typeof nothing {
  if (skill.status === "idle" || !skill.enabled) return nothing;
  if (skill.status === "updating") {
    return html`
      <div class="skill-card__status">
        <span class="skill-card__status-icon skill-card__status-icon--spin">${icons.refresh}</span>
        <span class="skill-card__status-text">更新中...</span>
      </div>
    `;
  }
  if (skill.status === "update_available") {
    return html`
      <div class="skill-card__status">
        <span class="skill-card__status-icon">${icons.refresh}</span>
        <span class="skill-card__status-text">更新</span>
      </div>
    `;
  }
  return nothing;
}

function renderSkillCard(
  skill: SkillCardEntry,
  onToggle: (skillKey: string) => void,
): TemplateResult {
  const disabledClass = !skill.enabled ? "skill-card--disabled" : "";
  return html`
    <div class="skill-card ${disabledClass}">
      <div class="skill-card__header">
        ${renderSkillIcon(skill)}
        <span class="skill-card__name">${skill.name}</span>
        ${renderSkillStatus(skill)}
        <div class="skill-card__divider"></div>
        <div
          class="skill-card__toggle ${skill.enabled ? "skill-card__toggle--on" : ""}"
          @click=${(e: Event) => { e.stopPropagation(); onToggle(skill.skillKey); }}
        >
          <div class="skill-card__toggle-thumb"></div>
        </div>
      </div>
      <div class="skill-card__desc">${skill.description}</div>
      ${skill.tags.length > 0
        ? html`
            <div class="skill-card__tags">
              ${skill.tags.map((tag) => html`<span class="skill-tag">${tag}</span>`)}
            </div>
          `
        : nothing}
    </div>
  `;
}

export function renderSkillsPage(
  props: ChatProps,
  requestUpdate: () => void,
): TemplateResult {
  const state = chatViewState;
  const onTabChange = (tab: SkillsTab) => {
    chatViewState.skillsTab = tab;
    requestUpdate();
  };
  const onSearchChange = (query: string) => {
    chatViewState.skillsPageSearchQuery = query;
    requestUpdate();
  };
  const onToggleDropdown = () => {
    chatViewState.skillsAddDropdownOpen = !chatViewState.skillsAddDropdownOpen;
    requestUpdate();
  };
  const onToggleSkill = async (skillKey: string) => {
    if (!props.client) return;
    const skill = state.skillsList.find((s) => s.skillKey === skillKey);
    if (!skill) return;
    try {
      await props.client.request("skills.setStatus", {
        skillKey,
        disabled: skill.enabled,
      });
      skill.enabled = !skill.enabled;
      requestUpdate();
    } catch {
      // 切换失败时不阻断
    }
  };

  const allSkills = state.skillsList;
  const filtered = filterSkills(allSkills, state.skillsPageSearchQuery);

  return html`
    <div class="cron-page">
      ${renderSidebar()}
      <div class="cron-page__main">
        ${renderTabBar()}
        ${renderSkillsHeader(
          state.skillsTab,
          onTabChange,
          state.skillsPageSearchQuery,
          onSearchChange,
          state.skillsAddDropdownOpen,
          onToggleDropdown,
          requestUpdate,
        )}
        <div class="cron-page__content">
          ${filtered.length === 0
            ? html`<div class="cron-page__empty">
                ${allSkills.length === 0 ? "暂无技能" : "没有匹配的技能"}
              </div>`
            : html`<div class="skills-grid">
                ${filtered.map((skill) => renderSkillCard(skill, onToggleSkill))}
              </div>`}
        </div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: 运行类型检查验证**

Run: `cd /Volumes/Data/Project/StudyPro/AiPro/openclaw && pnpm tsgo 2>&1 | head -30`
Expected: 可能有 `icons.upload` 和 `icons.plus` 不存在的错误，将在下一步处理

---

### Task 3: 确认 icons.ts 中的图标

**Files:**
- Modify: `ui/src/ui/views/chat-standalone/skills-page.ts`（如需替换图标）

- [ ] **Step 1: 检查 icons.ts 中是否有 `upload` 和 `plus` 图标**

Run: `cd /Volumes/Data/Project/StudyPro/AiPro/openclaw && grep -n "upload\|plus\|search\|refresh\|wrench\|caretDown" ui/src/ui/icons.ts | head -20`

根据 `icons.ts` 文件，`search`、`refresh`、`wrench`、`caretDownFill` 已存在。如果没有 `upload` 和 `plus`，需要用已有的替代图标：

- `upload` → 用 `icons.arrowUp` 或已有的上传图标
- `plus` → 用 `icons.plusCircle` 或直接用 SVG

如果缺少 `plus` 图标，在 skills-page.ts 中将 `icons.plus` 替换为内联 SVG：

```typescript
// 替换 icons.plus
html`<svg viewBox="0 0 24 24" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" /><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" /></svg>`
```

如果缺少 `upload` 图标，将 `icons.upload` 替换为内联 SVG：

```typescript
html`<svg viewBox="0 0 24 24" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" fill="none" /><polyline points="17 8 12 3 7 8" stroke="currentColor" stroke-width="2" fill="none" /><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="2" /></svg>`
```

- [ ] **Step 2: 再次运行类型检查**

Run: `cd /Volumes/Data/Project/StudyPro/AiPro/openclaw && pnpm tsgo 2>&1 | head -20`
Expected: 无错误

---

### Task 4: 添加路由 — chat-standalone.ts

**Files:**
- Modify: `ui/src/ui/views/chat-standalone.ts`

- [ ] **Step 1: 添加 import**

在文件顶部 import 区域，`renderCronCreatePage` 导入之后添加：

```typescript
import { renderSkillsPage } from "./chat-standalone/skills-page.ts";
```

- [ ] **Step 2: 添加路由判断函数**

在 `isCronRoute()` 函数之后（约第 321 行）添加：

```typescript
function isSkillsRoute(): boolean {
  return window.location.hash === "#skills";
}
```

- [ ] **Step 3: 在 `renderChatStandalone` 中添加 skills 路由处理**

在 `renderChatStandalone` 函数中，`if (isCronRoute())` 判断块**之前**（约第 369 行），添加：

```typescript
  if (isSkillsRoute()) {
    if (!chatViewState.skillsListLoaded && props.connected && props.client) {
      void loadSkillsCardList(props.client).then(() => requestUpdate());
    }
    return html`
      <div class="chat-standalone__shell" style="grid-template-columns: 1fr">
        ${renderSkillsPage(props, requestUpdate)}
      </div>
    `;
  }
```

注意：需要额外导入 `loadSkillsCardList`。在 import 区域的 state.ts 导入中添加：

```typescript
import {
  chatViewState,
  clearEmptyStateCronLoadRequested,
  getDeletedMessages,
  getExpandedToolCards,
  getInputHistory,
  getPinnedMessages,
  hasEmptyStateCronLoadRequested,
  loadSkillsCardList,
  loadSkillsList,
  markEmptyStateCronLoadRequested,
  resetChatViewState as resetChatViewStateImpl,
  cleanupChatModuleState as cleanupChatModuleStateImpl,
} from "./chat-standalone/state.ts";
```

- [ ] **Step 4: 运行类型检查**

Run: `cd /Volumes/Data/Project/StudyPro/AiPro/openclaw && pnpm tsgo 2>&1 | head -20`
Expected: 无错误

---

### Task 5: 添加 CSS 样式

**Files:**
- Modify: `ui/src/styles/chat-standalone.css`

- [ ] **Step 1: 在文件末尾添加技能页面样式**

```css
/* ========== 技能管理页面 ========== */

.skills-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 16px;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
}

.skills-header__left {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 100%;
}

.skills-header__tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  cursor: pointer;
  position: relative;
  padding: 0 4px;
}

.skills-header__tab-text {
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  line-height: 22px;
  color: #1e1f1f;
  padding: 4px 0;
  white-space: nowrap;
}

.skills-header__tab--active .skills-header__tab-text {
  font-weight: 600;
}

.skills-header__tab--active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: #0080ff;
  border-radius: 1px;
}

.skills-header__right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.skills-header__search {
  position: relative;
  display: flex;
  align-items: center;
  width: 196px;
}

.skills-header__search-icon {
  position: absolute;
  left: 8px;
  display: inline-flex;
  width: 16px;
  height: 16px;
  color: #8e9091;
  pointer-events: none;
}

.skills-header__search-icon svg {
  width: 16px;
  height: 16px;
}

.skills-header__search input {
  width: 100%;
  height: 28px;
  padding: 0 8px 0 28px;
  border: 1px solid #e6e8eb;
  border-radius: 4px;
  background: #fff;
  color: #1e1f1f;
  font-size: 14px;
  line-height: 22px;
  outline: none;
  box-sizing: border-box;
}

.skills-header__search input::placeholder {
  color: #8e9091;
}

.skills-header__search input:focus {
  border-color: #0080ff;
}

.skills-header__add-wrap {
  position: relative;
}

.skills-header__add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: 4px;
  background: #0080ff;
  color: #fff;
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
  box-sizing: border-box;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.skills-header__add-btn:hover {
  background: #0067cc;
}

.skills-header__add-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
}

.skills-header__add-icon svg {
  width: 16px;
  height: 16px;
}

.skills-header__add-text {
  white-space: nowrap;
}

.skills-header__add-arrow {
  display: inline-flex;
  width: 16px;
  height: 16px;
}

.skills-header__add-arrow svg {
  width: 12px;
  height: 12px;
}

.skills-header__add-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
}

.skills-header__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  width: 160px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 4px 24px rgba(0, 25, 50, 0.12);
  padding: 8px;
  z-index: 201;
}

.skills-header__dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 14px;
  line-height: 22px;
  color: #1e1f1f;
  cursor: pointer;
  white-space: nowrap;
}

.skills-header__dropdown-item:hover {
  background: #f0f1f3;
}

.skills-header__dropdown-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
  color: #1e1f1f;
}

.skills-header__dropdown-icon svg {
  width: 16px;
  height: 16px;
}

/* ========== 技能卡片网格 ========== */

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(329px, 1fr));
  gap: 12px;
  align-items: start;
}

.skill-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  border: 1px solid #e6e8eb;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 4px 24px rgba(0, 25, 50, 0.12);
  cursor: default;
}

.skill-card--disabled .skill-card__name {
  color: #8e9091;
}

.skill-card--disabled .skill-card__icon {
  background: #c5c7c9 !important;
}

.skill-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  flex-shrink: 0;
}

.skill-card__icon-char {
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  line-height: 22px;
  color: #fff;
}

.skill-card__icon--image {
  background: #fff;
  border: 1px solid #e6e8eb;
  overflow: hidden;
}

.skill-card__icon--image img {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  object-fit: cover;
}

.skill-card__name {
  flex: 1 1 auto;
  min-width: 0;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: #1e1f1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-card__status {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0;
  border-radius: 2px;
}

.skill-card__status-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
  color: #0080ff;
}

.skill-card__status-icon svg {
  width: 16px;
  height: 16px;
}

.skill-card__status-icon--spin svg {
  animation: skill-card-spin 1s linear infinite;
}

@keyframes skill-card-spin {
  to { transform: rotate(360deg); }
}

.skill-card__status-text {
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  line-height: 20px;
  color: #0080ff;
  white-space: nowrap;
}

.skill-card__divider {
  width: 1px;
  height: 12px;
  background: #e6e8eb;
  flex-shrink: 0;
}

.skill-card__toggle {
  position: relative;
  width: 32px;
  height: 16px;
  border-radius: 8px;
  background: #e6e8eb;
  cursor: pointer;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.skill-card__toggle--on {
  background: #0080ff;
}

.skill-card__toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.2s ease;
}

.skill-card__toggle--on .skill-card__toggle-thumb {
  left: 18px;
}

.skill-card__desc {
  padding-left: 32px;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  line-height: 20px;
  color: #8e9091;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.skill-card__tags {
  display: flex;
  gap: 8px;
  padding-left: 32px;
  padding-top: 4px;
  flex-wrap: wrap;
}

.skill-tag {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 4px;
  background: #f2f3f8;
  border-radius: 2px;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  line-height: 20px;
  color: #7f8bb7;
  white-space: nowrap;
}
```

- [ ] **Step 2: 构建前端验证 CSS**

Run: `cd /Volumes/Data/Project/StudyPro/AiPro/openclaw && pnpm build 2>&1 | tail -10`
Expected: 构建成功

---

### Task 6: 构建并验证

- [ ] **Step 1: 运行完整类型检查**

Run: `cd /Volumes/Data/Project/StudyPro/AiPro/openclaw && pnpm tsgo 2>&1 | head -30`
Expected: 无错误

- [ ] **Step 2: 运行完整构建**

Run: `cd /Volumes/Data/Project/StudyPro/AiPro/openclaw && pnpm build 2>&1 | tail -15`
Expected: 构建成功

- [ ] **Step 3: 浏览器验证**

在浏览器访问：
```
http://localhost:18789/chat/standalone?session=agent:main:dashboard:179e7f58-2c9a-4f38-9838-3b02d083abc6#skills
```

验证清单：
- [ ] 页面左侧 sidebar 显示，"技能广场"高亮
- [ ] 顶部显示 "我的技能" 和 "技能广场" 两个 tab
- [ ] "我的技能" tab 有蓝色下划线激活态
- [ ] 搜索框显示 placeholder "搜索技能名称"
- [ ] "添加"蓝色按钮，点击弹出下拉菜单（查找技能/上传技能/创建技能）
- [ ] 技能卡片以 grid 排列，每个卡片显示图标、名称、描述、标签、开关
- [ ] 搜索输入可过滤卡片
- [ ] 点击开关可切换启用/禁用状态
- [ ] 点击 sidebar "综合助手" 返回聊天页面

---

## Self-Review Checklist

### Spec Coverage
- [x] 标题栏双 Tab（我的技能/技能广场）→ Task 2 renderSkillsHeader
- [x] 搜索框 → Task 2 renderSkillsHeader
- [x] 添加按钮下拉菜单 → Task 2 renderSkillsHeader + renderSkillsPage
- [x] 技能卡片网格 → Task 2 renderSkillCard + skills-grid CSS
- [x] 卡片：图标+名称+状态+开关+描述+标签 → Task 2 renderSkillCard
- [x] Toggle 开关交互 → Task 2 onToggleSkill
- [x] 禁用态样式 → Task 5 CSS .skill-card--disabled
- [x] 更新中旋转动画 → Task 5 CSS @keyframes skill-card-spin
- [x] Hash 路由 #skills → Task 4
- [x] Sidebar 导航 → Task 2 renderSidebar

### Placeholder Scan
- [x] 无 "TBD"、"TODO"、"implement later"
- [x] 所有步骤包含完整代码
- [x] 无 "add appropriate error handling" 等泛指描述

### Type Consistency
- [x] `SkillCardEntry` 在 Task 1 定义，Task 2 使用，字段名一致
- [x] `chatViewState.skillsTab` 类型 `"my" | "market"` 与 `SkillsTab` 一致
- [x] `chatViewState.skillsList` 类型 `SkillCardEntry[]` 与渲染函数参数一致
