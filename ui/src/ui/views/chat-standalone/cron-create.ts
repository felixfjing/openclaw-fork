import { html, nothing, type TemplateResult } from "lit";
import { icons } from "../../icons.ts";
import type { ChatProps } from "./types.ts";
import type { CronCreateForm } from "./state.ts";

type CycleType = CronCreateForm["cycleType"];

const weekDayOptions = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const monthDayOptions = Array.from({ length: 31 }, (_, i) => `${i + 1}`);
const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function renderInput(
  label: string,
  required: boolean,
  value: string,
  placeholder: string,
  onChange: (v: string) => void,
): TemplateResult {
  return html`
    <div class="cron-create__field">
      <label class="cron-create__label">
        ${label}${required ? html`<span class="cron-create__required">*</span>` : nothing}
      </label>
      <input
        class="cron-create__input"
        type="text"
        .value=${value}
        placeholder=${placeholder}
        @input=${(e: Event) => onChange((e.target as HTMLInputElement).value)}
      />
    </div>
  `;
}

function renderSelect(
  label: string,
  value: string,
  options: string[],
  placeholder: string,
  onChange: (v: string) => void,
): TemplateResult {
  return html`
    <div class="cron-create__field">
      <label class="cron-create__label">${label}</label>
      <div class="cron-create__select-wrap">
        <select class="cron-create__select" .value=${value} @change=${(e: Event) => onChange((e.target as HTMLSelectElement).value)}>
          <option value="" disabled selected>${placeholder}</option>
          ${options.map((opt) => html`<option value=${opt} ?selected=${opt === value}>${opt}</option>`)}
        </select>
        <span class="cron-create__select-arrow">${icons.caretDownFill}</span>
      </div>
    </div>
  `;
}

function renderCycleRadios(
  cycleType: CycleType,
  weekDay: string,
  monthDay: string,
  onChange: (field: keyof CronCreateForm, value: string) => void,
): TemplateResult {
  const cycles: { value: CycleType; label: string }[] = [
    { value: "daily", label: "每天" },
    { value: "tradingDay", label: "交易日" },
    { value: "weekly", label: "每周" },
    { value: "monthly", label: "每月" },
  ];

  return html`
    <div class="cron-create__field">
      <label class="cron-create__label">
        执行周期<span class="cron-create__required">*</span>
      </label>
      <div class="cron-create__radio-group">
        ${cycles.map(
          (c) => html`
            <label class="cron-create__radio">
              <input
                type="radio"
                name="cycleType"
                value=${c.value}
                .checked=${cycleType === c.value}
                @change=${() => onChange("cycleType", c.value)}
              />
              <span class="cron-create__radio-label">${c.label}</span>
            </label>
          `,
        )}
        ${cycleType === "weekly"
          ? html`
              <span class="cron-create__divider"></span>
              <div class="cron-create__select-wrap cron-create__select-wrap--inline">
                <select class="cron-create__select cron-create__select--sm" .value=${weekDay} @change=${(e: Event) => onChange("weekDay", (e.target as HTMLSelectElement).value)}>
                  <option value="" disabled selected>请选择</option>
                  ${weekDayOptions.map((d) => html`<option value=${d} ?selected=${d === weekDay}>${d}</option>`)}
                </select>
                <span class="cron-create__select-arrow">${icons.caretDownFill}</span>
              </div>
            `
          : nothing}
        ${cycleType === "monthly"
          ? html`
              <span class="cron-create__divider"></span>
              <div class="cron-create__select-wrap cron-create__select-wrap--inline">
                <select class="cron-create__select cron-create__select--sm" .value=${monthDay} @change=${(e: Event) => onChange("monthDay", (e.target as HTMLSelectElement).value)}>
                  <option value="" disabled selected>请选择</option>
                  ${monthDayOptions.map((d) => html`<option value=${d} ?selected=${d === monthDay}>${d}日</option>`)}
                </select>
                <span class="cron-create__select-arrow">${icons.caretDownFill}</span>
              </div>
            `
          : nothing}
      </div>
    </div>
  `;
}

function renderTimePicker(
  hour: string,
  minute: string,
  onChange: (field: keyof CronCreateForm, value: string) => void,
): TemplateResult {
  return html`
    <div class="cron-create__field">
      <label class="cron-create__label">
        执行时间<span class="cron-create__required">*</span>
      </label>
      <div class="cron-create__time-picker">
        <div class="cron-create__select-wrap">
          <select class="cron-create__select cron-create__select--sm" .value=${hour} @change=${(e: Event) => onChange("hour", (e.target as HTMLSelectElement).value)}>
            ${hourOptions.map((h) => html`<option value=${h} ?selected=${h === hour}>${h}</option>`)}
          </select>
          <span class="cron-create__select-arrow">${icons.caretDownFill}</span>
        </div>
        <span class="cron-create__time-unit">时</span>
        <div class="cron-create__select-wrap">
          <select class="cron-create__select cron-create__select--sm" .value=${minute} @change=${(e: Event) => onChange("minute", (e.target as HTMLSelectElement).value)}>
            ${minuteOptions.map((m) => html`<option value=${m} ?selected=${m === minute}>${m}</option>`)}
          </select>
          <span class="cron-create__select-arrow">${icons.caretDownFill}</span>
        </div>
        <span class="cron-create__time-unit">分</span>
      </div>
    </div>
  `;
}

export interface CronCreateErrors {
  taskName?: string;
  cycleType?: string;
  hour?: string;
  minute?: string;
}

export function validateCronForm(form: CronCreateForm): CronCreateErrors {
  const errors: CronCreateErrors = {};
  if (!form.taskName.trim()) {
    errors.taskName = "请输入任务名称";
  }
  if (form.cycleType === "weekly" && !form.weekDay) {
    errors.cycleType = "请选择星期";
  }
  if (form.cycleType === "monthly" && !form.monthDay) {
    errors.cycleType = "请选择日期";
  }
  if (!form.hour) {
    errors.hour = "请选择小时";
  }
  if (!form.minute) {
    errors.minute = "请选择分钟";
  }
  return errors;
}

export function renderCronCreatePage(
  props: ChatProps,
  form: CronCreateForm,
  errors: CronCreateErrors,
  onFormChange: (field: keyof CronCreateForm, value: string) => void,
  onSave: () => void,
): TemplateResult {
  const modelOptions = props.modelSelectState?.options ?? [];

  return html`
    <div class="cron-create">
      <div class="cron-create__dialog">
        <div class="cron-create__header">
          <span class="cron-create__header-title">定时任务</span>
          <button
            class="cron-create__header-close"
            @click=${() => { window.location.hash = "#cron"; }}
          >${icons.x}</button>
        </div>
        <div class="cron-create__scroll">
          <div class="cron-create__form">
        <section class="cron-create__section">
          <h3 class="cron-create__section-title">任务基础信息</h3>
          <div class="cron-create__section-body">
            ${renderInput("任务名称", true, form.taskName, "请输入任务名称", (v) => onFormChange("taskName", v))}
            ${errors.taskName ? html`<span class="cron-create__error">${errors.taskName}</span>` : nothing}
            ${renderSelect("工作空间", form.workspace, ["WarrenQ"], "请选择工作空间", (v) => onFormChange("workspace", v))}
            <div class="cron-create__field">
              <label class="cron-create__label">提示词</label>
              <div class="cron-create__textarea-wrap">
                <textarea
                  class="cron-create__textarea"
                  .value=${form.prompt}
                  placeholder="请输入内容"
                  @input=${(e: Event) => onFormChange("prompt", (e.target as HTMLTextAreaElement).value)}
                ></textarea>
                <div class="cron-create__model-bar">
                  <span class="cron-create__model-icon">${icons.brain}</span>
                  <span class="cron-create__model-name">${form.model || "请选择模型"}</span>
                  <select
                    class="cron-create__model-select"
                    .value=${form.model}
                    @change=${(e: Event) => onFormChange("model", (e.target as HTMLSelectElement).value)}
                  >
                    ${modelOptions.map(
                      (opt) => html`<option value=${opt.value} ?selected=${opt.value === form.model}>${opt.label}</option>`,
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="cron-create__section">
          <h3 class="cron-create__section-title">执行规则设置</h3>
          <div class="cron-create__section-body">
            ${renderCycleRadios(form.cycleType, form.weekDay, form.monthDay, onFormChange)}
            ${errors.cycleType ? html`<span class="cron-create__error">${errors.cycleType}</span>` : nothing}
            ${renderTimePicker(form.hour, form.minute, onFormChange)}
          </div>
        </section>
      </div>

      <div class="cron-create__footer">
        <div class="cron-create__footer-left">
          <button
            class="cron-create__btn cron-create__btn--danger"
            type="button"
            @click=${() => { window.location.hash = "#cron"; }}
          >
            ${icons.x}
            <span>删除</span>
          </button>
          <button
            class="cron-create__btn"
            type="button"
            @click=${onSave}
          >
            ${icons.play}
            <span>测试运行</span>
          </button>
          <button
            class="cron-create__btn"
            type="button"
            @click=${onSave}
          >
            ${icons.pause}
            <span>暂停</span>
          </button>
        </div>
        <div class="cron-create__footer-right">
          <button
            class="cron-create__btn"
            type="button"
            @click=${() => { window.location.hash = "#cron"; }}
          >取消</button>
          <button
            class="cron-create__btn cron-create__btn--primary"
            type="button"
            @click=${onSave}
          >保存</button>
        </div>
      </div>
        </div>
      </div>
    </div>
  `;
}
