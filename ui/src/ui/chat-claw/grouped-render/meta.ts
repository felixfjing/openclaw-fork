import { html, nothing } from "lit";
import type { MessageGroup } from "../../types/chat-types.ts";

export type GroupMeta = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  model: string | null;
  contextPercent: number | null;
};

export function extractGroupMeta(
  group: MessageGroup,
  contextWindow: number | null,
): GroupMeta | null {
  let input = 0;
  let output = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let cost = 0;
  let model: string | null = null;
  let hasUsage = false;

  for (const { message } of group.messages) {
    const m = message as Record<string, unknown>;
    if (m.role !== "assistant") {
      continue;
    }
    const usage = m.usage as Record<string, number> | undefined;
    if (usage) {
      hasUsage = true;
      input += usage.input ?? usage.inputTokens ?? 0;
      output += usage.output ?? usage.outputTokens ?? 0;
      cacheRead += usage.cacheRead ?? usage.cache_read_input_tokens ?? 0;
      cacheWrite += usage.cacheWrite ?? usage.cache_creation_input_tokens ?? 0;
    }
    const c = m.cost as Record<string, number> | undefined;
    if (c?.total) {
      cost += c.total;
    }
    if (typeof m.model === "string" && m.model !== "gateway-injected") {
      model = m.model;
    }
  }

  if (!hasUsage && !model) {
    return null;
  }

  const contextPercent =
    contextWindow && input > 0
      ? Math.min(Math.round((input / contextWindow) * 100), 100)
      : null;

  return { input, output, cacheRead, cacheWrite, cost, model, contextPercent };
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(n);
}

export function renderMessageMeta(meta: GroupMeta | null) {
  if (!meta) {
    return nothing;
  }

  const parts: Array<ReturnType<typeof html>> = [];

  if (meta.input) {
    parts.push(
      html`<span class="msg-meta__tokens">↑${fmtTokens(meta.input)}</span>`,
    );
  }
  if (meta.output) {
    parts.push(
      html`<span class="msg-meta__tokens">↓${fmtTokens(meta.output)}</span>`,
    );
  }

  if (meta.cacheRead) {
    parts.push(
      html`<span class="msg-meta__cache">R${fmtTokens(meta.cacheRead)}</span>`,
    );
  }
  if (meta.cacheWrite) {
    parts.push(
      html`<span class="msg-meta__cache">W${fmtTokens(meta.cacheWrite)}</span>`,
    );
  }

  if (meta.cost > 0) {
    parts.push(
      html`<span class="msg-meta__cost">$${meta.cost.toFixed(4)}</span>`,
    );
  }

  if (meta.contextPercent !== null) {
    const pct = meta.contextPercent;
    const cls =
      pct >= 90
        ? "msg-meta__ctx msg-meta__ctx--danger"
        : pct >= 75
          ? "msg-meta__ctx msg-meta__ctx--warn"
          : "msg-meta__ctx";
    parts.push(html`<span class="${cls}">${pct}% ctx</span>`);
  }

  if (meta.model) {
    const shortModel = meta.model.includes("/")
      ? meta.model.split("/").pop()!
      : meta.model;
    parts.push(html`<span class="msg-meta__model">${shortModel}</span>`);
  }

  if (parts.length === 0) {
    return nothing;
  }

  return html`<span class="msg-meta">${parts}</span>`;
}
