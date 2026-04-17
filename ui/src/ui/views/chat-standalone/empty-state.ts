import { html, type TemplateResult } from "lit";
import type { ChatProps } from "./types.ts";

function resolveEmptyStateImageUrl(basePath: string | undefined): string {
  const explicitBase = basePath?.trim().replace(/\/$/, "");
  if (explicitBase) {
    return `${explicitBase}/empty-state.png`;
  }
  return `${import.meta.env.BASE_URL}empty-state.png`;
}

export function renderEmptyState(props: ChatProps): TemplateResult {
  const imageUrl = resolveEmptyStateImageUrl(props.basePath);

  return html`
    <div class="chat-standalone__empty-state" role="status" aria-live="polite">
      <img
        class="chat-standalone__empty-state-image"
        src=${imageUrl}
        alt="Empty chat state"
      />
    </div>
  `;
}
