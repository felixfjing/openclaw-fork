import { html, type TemplateResult } from "lit";

export function renderLoadingState(): TemplateResult {
  return html`
    <div
      class="chat-loading-state"
      role="status"
      aria-live="polite"
      aria-label="正在切换会话"
    >
      <span class="chat-loading-state__spinner" aria-hidden="true"></span>
      <div class="chat-loading-state__body">
        <div class="chat-loading-state__title">
          正在切换会话
          <span class="chat-loading-state__dots" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </div>
        <div class="chat-loading-state__description">
          请稍候，当前会话内容正在载入。
        </div>
      </div>
    </div>
  `;
}
