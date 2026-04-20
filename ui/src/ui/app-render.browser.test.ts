import { render } from "lit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../i18n/index.ts";
import { renderApp } from "./app-render.ts";
import type { AppViewState } from "./app-view-state.ts";

function createStandaloneState(overrides: Partial<AppViewState> = {}) {
  return {
    settings: {
      gatewayUrl: "ws://127.0.0.1:18789",
      token: "standalone-token",
    },
    chatStandalone: true,
    pendingGatewayUrl: null,
    pendingGatewayToken: null,
    connected: false,
    tab: "chat",
    onboarding: false,
    basePath: "",
    lastError: null,
    lastErrorCode: null,
    ...overrides,
  } as AppViewState;
}

describe("renderApp standalone auth gate", () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.append(container);
    await i18n.setLocale("en");
  });

  afterEach(() => {
    container.remove();
    vi.unstubAllGlobals();
  });

  it("shows a connecting state instead of the login gate when standalone has a token", () => {
    render(renderApp(createStandaloneState()), container);

    expect(container.querySelector(".standalone-connecting")).not.toBeNull();
    expect(container.querySelector(".login-gate")).toBeNull();
    expect(container.textContent).toContain("正在加载");
  });

  it("keeps the login gate for standalone when no token is available", () => {
    render(
      renderApp(
        createStandaloneState({
          settings: {
            gatewayUrl: "ws://127.0.0.1:18789",
            token: "",
          },
          pendingGatewayToken: null,
        }),
      ),
      container,
    );

    expect(container.querySelector(".login-gate")).not.toBeNull();
    expect(container.querySelector(".standalone-connecting")).toBeNull();
  });

  it("falls back to the login gate after a standalone token connection error", () => {
    render(
      renderApp(
        createStandaloneState({
          lastError: "disconnected (4008): connect failed",
        }),
      ),
      container,
    );

    expect(container.querySelector(".login-gate")).not.toBeNull();
    expect(container.querySelector(".standalone-connecting")).toBeNull();
  });
});
