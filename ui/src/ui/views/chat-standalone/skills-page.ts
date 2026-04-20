import { html, nothing, type TemplateResult } from "lit";
import { icons } from "../../icons.ts";
import type { ChatProps } from "./types.ts";
import { chatViewState, type SkillCardEntry } from "./state.ts";

type SkillsTab = "my" | "market";

function filterSkills(skills: SkillCardEntry[], query: string): SkillCardEntry[] {
  if (!query.trim()) return skills;
  const q = query.toLowerCase();
  return skills.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

const iconUpload = html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
`;

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
        <span
          class="cron-page__tabbar-btn"
          title="刷新"
          @click=${() => window.location.reload()}
        >${icons.refresh}</span>
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
                    <span class="skills-header__dropdown-icon">${iconUpload}</span>
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
