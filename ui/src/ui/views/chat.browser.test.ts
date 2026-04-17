import { render } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../test-helpers/load-styles.ts";
import type { CronJob } from "../types.ts";
import {
  cleanupChatModuleState,
  renderChatStandalone,
  type ChatProps as StandaloneChatProps,
} from "./chat-standalone.ts";
import { renderChat, type ChatProps } from "./chat.ts";

const contextNoticeSessions: ChatProps["sessions"] = {
  ts: 0,
  path: "",
  count: 1,
  defaults: { modelProvider: "openai", model: "gpt-5", contextTokens: null },
  sessions: [
    {
      key: "main",
      kind: "direct",
      updatedAt: null,
      totalTokens: 3_800,
      inputTokens: 3_800,
      contextTokens: 4_000,
    },
  ],
};

function createProps(overrides: Partial<ChatProps> = {}): ChatProps {
  return {
    sessionKey: "main",
    onSessionKeyChange: () => undefined,
    thinkingLevel: null,
    showThinking: false,
    showToolCalls: true,
    loading: false,
    sending: false,
    canAbort: false,
    compactionStatus: null,
    fallbackStatus: null,
    messages: [],
    toolMessages: [],
    streamSegments: [],
    stream: null,
    streamStartedAt: null,
    assistantAvatarUrl: null,
    draft: "",
    queue: [],
    connected: true,
    canSend: true,
    disabledReason: null,
    error: null,
    sessions: {
      ts: 0,
      path: "",
      count: 1,
      defaults: {
        modelProvider: "openai",
        model: "gpt-5",
        contextTokens: null,
      },
      sessions: [
        {
          key: "main",
          kind: "direct",
          updatedAt: null,
          inputTokens: 3_800,
          contextTokens: 4_000,
        },
      ],
    },
    focusMode: false,
    assistantName: "OpenClaw",
    assistantAvatar: null,
    onRefresh: () => undefined,
    onToggleFocusMode: () => undefined,
    onDraftChange: () => undefined,
    onSend: () => undefined,
    onQueueRemove: () => undefined,
    onNewSession: () => undefined,
    agentsList: null,
    currentAgentId: "",
    onAgentChange: () => undefined,
    ...overrides,
  };
}

function createStandaloneProps(overrides: Partial<StandaloneChatProps> = {}): StandaloneChatProps {
  return {
    ...createProps(),
    agentsList: null,
    currentAgentId: "main",
    onAgentChange: () => undefined,
    modelSelectState: {
      currentOverride: "openai/gpt-5-mini",
      defaultModel: "openai/gpt-5",
      defaultDisplay: "GPT-5 · openai",
      defaultLabel: "Default model",
      options: [
        { value: "openai/gpt-5-mini", label: "GPT-5 Mini · openai" },
        { value: "openai/gpt-5", label: "GPT-5 · openai" },
      ],
    },
    onModelChange: () => undefined,
    ...overrides,
  };
}

async function renderContextNoticeChat() {
  const container = document.createElement("div");
  document.body.append(container);
  render(
    renderChat(
      createProps({
        sessions: contextNoticeSessions,
      }),
    ),
    container,
  );
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return container;
}

describe("chat context notice", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("falls back to default notice colors when theme vars are not hex", async () => {
    document.documentElement.style.setProperty("--warn", "rgb(1, 2, 3)");
    document.documentElement.style.setProperty("--danger", "tomato");
    const container = await renderContextNoticeChat();

    const notice = container.querySelector<HTMLElement>(".context-notice");
    expect(notice).not.toBeNull();
    expect(notice?.style.getPropertyValue("--ctx-color")).toContain("rgb(");
    expect(notice?.style.getPropertyValue("--ctx-color")).not.toContain("NaN");
    expect(notice?.style.getPropertyValue("--ctx-bg")).not.toContain("NaN");

    document.documentElement.style.removeProperty("--warn");
    document.documentElement.style.removeProperty("--danger");
  });

  it("keeps the warning icon badge-sized", async () => {
    const container = await renderContextNoticeChat();

    const icon = container.querySelector<SVGElement>(".context-notice__icon");
    expect(icon).not.toBeNull();
    if (!icon) {
      return;
    }

    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon.classList.contains("context-notice__icon")).toBe(true);
    expect(icon.getAttribute("width")).toBe("16");
    expect(icon.getAttribute("height")).toBe("16");
    expect(icon.querySelector("path")).not.toBeNull();
  });
});

describe("chat standalone model picker", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    cleanupChatModuleState();
  });

  it("renders the footer selector as a model picker", () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(renderChatStandalone(createStandaloneProps()), container);

    const modelSelect = container.querySelector<HTMLSelectElement>(
      'select[data-chat-model-select="true"]',
    );
    expect(modelSelect).not.toBeNull();
    expect(modelSelect?.value).toBe("openai/gpt-5-mini");
    expect(container.querySelector(".agent-chat__agent-select-label")?.textContent).toBe("Model");
  });

  it("renders cron tasks in the empty state", () => {
    const container = document.createElement("div");
    const onLoadCron = vi.fn();
    const cronJobs: CronJob[] = [
      {
        id: "cron-1",
        name: "Daily ping",
        enabled: true,
        createdAtMs: 0,
        updatedAtMs: 0,
        schedule: { kind: "cron", expr: "0 9 * * *" },
        sessionTarget: "main",
        wakeMode: "next-heartbeat",
        payload: { kind: "systemEvent", text: "Ping the main timeline" },
        state: {
          lastStatus: "error",
          nextRunAtMs: 1_700_000_000_000,
          lastRunAtMs: 1_699_999_000_000,
        },
      },
    ];

    render(
      renderChatStandalone(
        createStandaloneProps({
          cronJobs,
          loadCron: onLoadCron,
        }),
      ),
      container,
    );

    const taskList = container.querySelector(".chat-standalone-empty__jobs");
    expect(taskList).not.toBeNull();
    expect(container.querySelectorAll(".chat-standalone-empty__job-card")).toHaveLength(1);
    expect(container.textContent).toContain("Daily ping");
    expect(container.textContent).toContain("Ping the main timeline");
    expect(container.textContent).toContain("main");
    expect(container.textContent).toContain("next-heartbeat");
    expect(container.textContent).toContain("Error");
    expect(onLoadCron).toHaveBeenCalledTimes(1);
  });
});
