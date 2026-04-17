/* @vitest-environment jsdom */

import { render } from "lit";
import { describe, expect, it } from "vitest";
import { renderLoadingState } from "./loading.ts";

describe("chat standalone loading state", () => {
  it("renders the session switch loading message", () => {
    const container = document.createElement("div");

    render(renderLoadingState(), container);

    expect(container.textContent).toContain("正在切换会话");
    expect(
      container.querySelector(".chat-loading-state__spinner"),
    ).not.toBeNull();
    expect(
      container.querySelectorAll(".chat-loading-state__dots span"),
    ).toHaveLength(3);
  });
});
