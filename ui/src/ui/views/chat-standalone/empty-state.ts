import { html, nothing, type TemplateResult } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { t } from "../../../i18n/index.ts";
import { formatMs, formatRelativeTimestamp } from "../../format.ts";
import { formatCronSchedule } from "../../presenter.ts";
import { icons } from "../../icons.ts";
import type { CronJob } from "../../types.ts";
import type { ChatProps } from "./types.ts";
import { chatViewState } from "./state.ts";

function resolveEmptyStateImageUrl(basePath: string | undefined): string {
  const explicitBase = basePath?.trim().replace(/\/$/, "");
  if (explicitBase) {
    return `${explicitBase}/empty-state.png`;
  }
  return "/empty-state.png";
}

function resolveTaskStatusLabel(status?: string | null): string {
  switch (status) {
    case "ok":
      return "成功";
    case "error":
      return "失败";
    case "skipped":
      return "跳过";
    default:
      return "--";
  }
}

function formatTime(ms?: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "--";
  return formatRelativeTimestamp(ms);
}

function formatTimeFull(ms?: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "--";
  return formatMs(ms);
}

function computeTodayStats(jobs: CronJob[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let total = 0;
  let ok = 0;
  let error = 0;

  for (const job of jobs) {
    const lastRun = job.state?.lastRunAtMs;
    if (lastRun && lastRun >= todayStart) {
      total++;
      if (job.state?.lastStatus === "ok") ok++;
      else if (job.state?.lastStatus === "error") error++;
    }
  }

  return { total, ok, error };
}

function renderCronTaskPanel(props: ChatProps): TemplateResult {
  const jobs = props.cronJobs ?? [];
  const stats = computeTodayStats(jobs);

  return html`
    <section class="cron-task-panel" aria-label="定时任务">
      <div class="cron-task-panel__header">
        <div class="cron-task-panel__header-left">
          <span class="cron-task-panel__header-icon">${icons.alarm}</span>
          <span class="cron-task-panel__header-label">定时任务</span>
          <span class="cron-task-panel__header-badge">
            今天执行${stats.total}次，成功${stats.ok}次，失败${stats.error}次
          </span>
        </div>
        <div class="cron-task-panel__header-right"
          @click=${() => {
            window.location.hash = "#cron";
          }}
        >
          <span class="cron-task-panel__header-more">更多</span>
          <span class="cron-task-panel__header-arrow">${icons.chevronRight}</span>
        </div>
      </div>
      ${jobs.length > 0
        ? html`<div class="cron-task-panel__grid">
            ${jobs.map((job) => renderCronTaskCard(job))}
          </div>`
        : html`<div class="cron-task-panel__empty">暂无定时任务</div>`}
    </section>
  `;
}

function renderCronTaskCard(job: CronJob): TemplateResult {
  const lastStatus = job.state?.lastStatus;
  const isSuccess = lastStatus === "ok";
  const isError = lastStatus === "error";
  const statusClass = isSuccess
    ? "cron-task-card__item-status--ok"
    : isError
      ? "cron-task-card__item-status--error"
      : "cron-task-card__item-status--na";
  const statusLabel = resolveTaskStatusLabel(lastStatus);

  const taskLabel =
    job.payload.kind === "systemEvent"
      ? job.payload.text
      : job.payload.message;

  return html`
    <div class="cron-task-card">
      <div class="cron-task-card__title">${job.name}</div>
      <div class="cron-task-card__items">
        <div class="cron-task-card__item">
          <div class="cron-task-card__item-row">
            <div class="cron-task-card__item-name">
              <span class="cron-task-card__item-icon">${icons.fileText}</span>
              <span class="cron-task-card__item-text" title=${ifDefined(taskLabel)}>${taskLabel}</span>
            </div>
            <div class=${`cron-task-card__item-status ${statusClass}`}>
              ${isSuccess ? icons.check : isError ? icons.x : nothing}
              <span>${statusLabel}</span>
            </div>
          </div>
          <div class="cron-task-card__item-time">
            <span class="cron-task-card__item-time-label">执行时间</span>
            <span class="cron-task-card__item-time-value" title=${ifDefined(formatTimeFull(job.state?.lastRunAtMs))}>
              ${formatTime(job.state?.lastRunAtMs)}
            </span>
          </div>
        </div>
        ${job.state?.nextRunAtMs
          ? html`
            <div class="cron-task-card__item">
              <div class="cron-task-card__item-row">
                <div class="cron-task-card__item-name">
                  <span class="cron-task-card__item-icon">${icons.clock}</span>
                  <span class="cron-task-card__item-text">下次执行</span>
                </div>
              </div>
              <div class="cron-task-card__item-time">
                <span class="cron-task-card__item-time-label">计划时间</span>
                <span class="cron-task-card__item-time-value" title=${ifDefined(formatTimeFull(job.state?.nextRunAtMs))}>
                  ${formatTime(job.state?.nextRunAtMs)}
                </span>
              </div>
            </div>
          `
          : nothing}
        ${job.schedule
          ? html`
            <div class="cron-task-card__item">
              <div class="cron-task-card__item-row">
                <div class="cron-task-card__item-name">
                  <span class="cron-task-card__item-icon">${icons.zap}</span>
                  <span class="cron-task-card__item-text">调度规则</span>
                </div>
              </div>
              <div class="cron-task-card__item-time">
                <span class="cron-task-card__item-time-label">规则</span>
                <span class="cron-task-card__item-time-value">${formatCronSchedule(job)}</span>
              </div>
            </div>
          `
          : nothing}
      </div>
    </div>
  `;
}

export function renderEmptyState(props: ChatProps): TemplateResult {
  const imageUrl = resolveEmptyStateImageUrl(props.basePath);
  return html`
    <div class="chat-standalone-empty" role="status" aria-live="polite">
      <div class="chat-standalone-empty__content">
        <img class="chat-standalone-empty__image" src=${imageUrl} alt="Empty chat state" />
        ${renderCronTaskPanel(props)}
      </div>
    </div>
  `;
}
