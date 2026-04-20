import { html, nothing, type TemplateResult } from "lit";
import { icons } from "../../icons.ts";
import { formatRelativeTimestamp } from "../../format.ts";
import { formatCronSchedule } from "../../presenter.ts";
import type { CronJob } from "../../types.ts";
import type { ChatProps } from "./types.ts";
import { filterCronJobsForAgent } from "./agent-filters.ts";

type CronFilter = "all" | "enabled" | "disabled";

interface SidebarItem {
  key: string;
  label: string;
  icon: TemplateResult;
}

const sidebarItems: SidebarItem[] = [
  { key: "home", label: "综合助手", icon: icons.messageSquare },
  { key: "cron", label: "定时任务", icon: icons.alarm },
  { key: "skills", label: "技能广场", icon: icons.wrench },
  { key: "experts", label: "专家Agent", icon: icons.graduationCap },
  { key: "docs", label: "文档中心", icon: icons.fileText },
];

function filterJobs(
  jobs: CronJob[],
  filter: CronFilter,
  query: string,
): CronJob[] {
  let filtered = jobs;
  if (filter === "enabled") {
    filtered = filtered.filter((j) => j.enabled);
  } else if (filter === "disabled") {
    filtered = filtered.filter((j) => !j.enabled);
  }
  if (query.trim()) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        (j.payload.kind === "systemEvent"
          ? j.payload.text?.toLowerCase().includes(q)
          : j.payload.message?.toLowerCase().includes(q)),
    );
  }
  return filtered;
}

function renderSidebar(): TemplateResult {
  return html`
    <nav class="cron-page__sidebar">
      <div class="cron-page__sidebar-main">
        ${sidebarItems.map(
          (item) => html`
            <div
              class="cron-page__sidebar-item ${item.key === "cron"
                ? "cron-page__sidebar-item--active"
                : ""}"
              title=${item.label}
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
          <span class="cron-page__tab-icon">${icons.alarm}</span>
          <span class="cron-page__tab-text">定时任务</span>
          <span
            class="cron-page__tab-close"
            @click=${() => {
              window.location.hash = "";
            }}
            >${icons.x}</span
          >
        </div>
      </div>
      <div class="cron-page__tabbar-actions">
        <span class="cron-page__tabbar-btn" title="刷新">${icons.refresh}</span>
      </div>
    </div>
  `;
}

function renderCronCard(job: CronJob): TemplateResult {
  const isEnabled = job.enabled;
  const desc =
    job.payload.kind === "systemEvent" ? job.payload.text : job.payload.message;

  return html`
    <div
      class="cron-card"
      @click=${() => {
        window.location.hash = `#cron/edit/${job.id}`;
      }}
    >
      <div class="cron-card__body">
        <div class="cron-card__title-row">
          <span class="cron-card__icon">${icons.brain}</span>
          <span class="cron-card__title" title=${job.name}>${job.name}</span>
          <span
            class=${`cron-card__badge ${isEnabled ? "cron-card__badge--active" : "cron-card__badge--paused"}`}
          >
            ${isEnabled ? icons.play : icons.pause}
            <span>${isEnabled ? "运行中" : "已暂停"}</span>
          </span>
        </div>
        <div class="cron-card__desc" title=${desc ?? ""}>${desc}</div>
      </div>
      <div class="cron-card__divider">
        <div class="cron-card__divider-line"></div>
      </div>
      <div class="cron-card__footer">
        <div class="cron-card__schedule">
          <span class="cron-card__alarm">${icons.alarm}</span>
          <span>${formatCronSchedule(job)}</span>
        </div>
        <div class="cron-card__last-run">
          ${job.state?.lastRunAtMs
            ? formatRelativeTimestamp(job.state.lastRunAtMs)
            : "--"}
        </div>
      </div>
    </div>
  `;
}

export function renderCronPage(
  props: ChatProps,
  state: { cronFilter: CronFilter; cronSearch: string },
  onFilterChange: (filter: CronFilter) => void,
  onSearchChange: (query: string) => void,
): TemplateResult {
  const jobs = filterCronJobsForAgent(
    props.cronJobs ?? [],
    props.currentAgentId,
  );
  const filtered = filterJobs(jobs, state.cronFilter, state.cronSearch);

  return html`
    <div class="cron-page">
      <div class="cron-page__main">
        <div class="cron-page__header">
          <span class="cron-page__header-title">定时任务</span>
          <div class="cron-page__header-controls">
            <select
              class="cron-page__filter-select"
              .value=${state.cronFilter}
              @change=${(e: Event) =>
                onFilterChange(
                  (e.target as HTMLSelectElement).value as CronFilter,
                )}
            >
              <option value="all">全部</option>
              <option value="enabled">已启用</option>
              <option value="disabled">已禁用</option>
            </select>
            <label class="cron-toolbar__search">
              <span class="cron-toolbar__search-icon">${icons.search}</span>
              <input
                type="search"
                placeholder="搜索任务"
                .value=${state.cronSearch}
                @input=${(e: Event) =>
                  onSearchChange((e.target as HTMLInputElement).value)}
              />
            </label>
            <button
              class="cron-toolbar__add-btn"
              @click=${() => {
                window.location.hash = "#cron/create";
              }}
            >
              新增
            </button>
          </div>
        </div>
        <div class="cron-page__content">
          ${filtered.length === 0
            ? html`<div class="cron-page__empty">
                ${jobs.length === 0 ? "暂无定时任务" : "没有匹配的任务"}
              </div>`
            : html`<div class="cron-card-grid">
                ${filtered.map((job) => renderCronCard(job))}
              </div>`}
        </div>
      </div>
    </div>
  `;
}
