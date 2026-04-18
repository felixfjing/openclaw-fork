import { html, nothing, type TemplateResult } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { t } from "../../../i18n/index.ts";
import { formatMs, formatRelativeTimestamp } from "../../format.ts";
import { formatCronSchedule } from "../../presenter.ts";
import type { CronJob } from "../../types.ts";
import type { ChatProps } from "./types.ts";

function resolveEmptyStateImageUrl(basePath: string | undefined): string {
  const explicitBase = basePath?.trim().replace(/\/$/, "");
  if (explicitBase) {
    return `${explicitBase}/empty-state.png`;
  }
  return "/empty-state.png";
}

function resolveTaskStatusClass(status?: string | null): string {
  switch (status) {
    case "ok":
      return "chat-standalone-empty__job-status--ok";
    case "error":
      return "chat-standalone-empty__job-status--error";
    case "skipped":
      return "chat-standalone-empty__job-status--skipped";
    default:
      return "chat-standalone-empty__job-status--na";
  }
}

function resolveTaskStatusLabel(status?: string | null): string {
  switch (status) {
    case "ok":
      return t("cron.runs.runStatusOk");
    case "error":
      return t("cron.runs.runStatusError");
    case "skipped":
      return t("cron.runs.runStatusSkipped");
    default:
      return t("common.na");
  }
}

function renderTaskTime(ms?: number) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) {
    return html`<span class="chat-standalone-empty__job-state-value">${t("common.na")}</span>`;
  }
  return html`<span class="chat-standalone-empty__job-state-value" title=${ifDefined(formatMs(ms))}>
    ${formatRelativeTimestamp(ms)}
  </span>`;
}

function renderTaskPayload(job: CronJob) {
  if (job.payload.kind === "systemEvent") {
    return html`<div class="chat-standalone-empty__job-detail">
      <span class="chat-standalone-empty__job-detail-label">${t("cron.jobDetail.system")}</span>
      <span class="chat-standalone-empty__job-detail-value">${job.payload.text}</span>
    </div>`;
  }

  return html`
    <div class="chat-standalone-empty__job-detail">
      <span class="chat-standalone-empty__job-detail-label">${t("cron.jobDetail.prompt")}</span>
      <span class="chat-standalone-empty__job-detail-value">${job.payload.message}</span>
    </div>
    ${job.payload.model
      ? html`<div class="chat-standalone-empty__job-detail">
          <span class="chat-standalone-empty__job-detail-label">${t("cron.form.model")}</span>
          <span class="chat-standalone-empty__job-detail-value">${job.payload.model}</span>
        </div>`
      : nothing}
    ${job.payload.thinking
      ? html`<div class="chat-standalone-empty__job-detail">
          <span class="chat-standalone-empty__job-detail-label">${t("cron.form.thinking")}</span>
          <span class="chat-standalone-empty__job-detail-value">${job.payload.thinking}</span>
        </div>`
      : nothing}
  `;
}

function renderTaskDelivery(job: CronJob) {
  const delivery = job.delivery;
  if (!delivery) {
    return nothing;
  }
  const deliveryTarget =
    delivery.mode === "webhook"
      ? delivery.to
        ? ` (${delivery.to})`
        : ""
      : delivery.channel || delivery.to
        ? ` (${delivery.channel ?? "last"}${delivery.to ? ` -> ${delivery.to}` : ""})`
        : "";

  return html`<div class="chat-standalone-empty__job-detail">
    <span class="chat-standalone-empty__job-detail-label">${t("cron.jobDetail.delivery")}</span>
    <span class="chat-standalone-empty__job-detail-value">${delivery.mode}${deliveryTarget}</span>
  </div>`;
}

function renderTask(job: CronJob) {
  const statusClass = resolveTaskStatusClass(job.state?.lastStatus);
  const statusLabel = resolveTaskStatusLabel(job.state?.lastStatus);

  return html`
    <article class="chat-standalone-empty__job-card" role="listitem">
      <div class="chat-standalone-empty__job-main">
        <div class="chat-standalone-empty__job-title">${job.name}</div>
        <div class="chat-standalone-empty__job-schedule">${formatCronSchedule(job)}</div>
        ${renderTaskPayload(job)}
        ${job.agentId
          ? html`<div class="chat-standalone-empty__job-agent">
              ${t("cron.jobDetail.agent")}: ${job.agentId}
            </div>`
          : nothing}
        ${renderTaskDelivery(job)}
      </div>
      <div class="chat-standalone-empty__job-meta">
        <div class="chat-standalone-empty__job-state">
          <div class="chat-standalone-empty__job-state-row">
            <span class="chat-standalone-empty__job-state-key">${t("cron.jobState.status")}</span>
            <span class=${`chat-standalone-empty__job-status ${statusClass}`}>${statusLabel}</span>
          </div>
          <div class="chat-standalone-empty__job-state-row">
            <span class="chat-standalone-empty__job-state-key">${t("cron.jobState.next")}</span>
            ${renderTaskTime(job.state?.nextRunAtMs)}
          </div>
          <div class="chat-standalone-empty__job-state-row">
            <span class="chat-standalone-empty__job-state-key">${t("cron.jobState.last")}</span>
            ${renderTaskTime(job.state?.lastRunAtMs)}
          </div>
        </div>
      </div>
      <div class="chat-standalone-empty__job-footer">
        <div class="chat-standalone-empty__job-chip-row">
          <span
            class=${`chat-standalone-empty__job-chip ${job.enabled ? "chat-standalone-empty__job-chip--ok" : "chat-standalone-empty__job-chip--danger"}`}
          >
            ${job.enabled ? t("cron.jobList.enabled") : t("cron.jobList.disabled")}
          </span>
          <span class="chat-standalone-empty__job-chip">${job.sessionTarget}</span>
          <span class="chat-standalone-empty__job-chip">${job.wakeMode}</span>
        </div>
      </div>
    </article>
  `;
}

function renderTaskList(jobs: CronJob[]) {
  if (jobs.length === 0) {
    return nothing;
  }

  return html`
    <section class="chat-standalone-empty__jobs" aria-label=${t("cron.jobs.title")}>
      <div class="chat-standalone-empty__jobs-title">${t("cron.jobs.title")}</div>
      <div class="chat-standalone-empty__jobs-grid" role="list">
        ${jobs.map((job) => renderTask(job))}
      </div>
    </section>
  `;
}

export function renderEmptyState(props: ChatProps): TemplateResult {
  const imageUrl = resolveEmptyStateImageUrl(props.basePath);
  return html`
    <div class="chat-standalone-empty" role="status" aria-live="polite">
      <div class="chat-standalone-empty__content">
        <img class="chat-standalone-empty__image" src=${imageUrl} alt="Empty chat state" />
        ${renderTaskList(props.cronJobs ?? [])}
      </div>
    </div>
  `;
}
