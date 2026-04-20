import { describe, expect, it } from "vitest";
import { resolveFirstSessionKeyForAgent } from "./agent-filters.ts";
import type { GatewaySessionRow } from "../../types.ts";

function sessionRow(
  overrides: Partial<GatewaySessionRow> & { key: string },
): GatewaySessionRow {
  return {
    key: overrides.key,
    kind: overrides.kind ?? "direct",
    updatedAt: overrides.updatedAt ?? null,
    ...overrides,
  } as GatewaySessionRow;
}

describe("resolveFirstSessionKeyForAgent", () => {
  it("returns the newest visible session for the selected agent", () => {
    const sessions: GatewaySessionRow[] = [
      sessionRow({ key: "agent:alpha:main", updatedAt: 10 }),
      sessionRow({ key: "agent:beta:older", updatedAt: 20 }),
      sessionRow({ key: "agent:beta:newer", updatedAt: 30 }),
      sessionRow({ key: "main", updatedAt: 40 }),
    ];

    expect(resolveFirstSessionKeyForAgent(sessions, "beta")).toBe(
      "agent:beta:newer",
    );
  });

  it("returns null when the agent has no visible sessions", () => {
    const sessions: GatewaySessionRow[] = [
      sessionRow({ key: "agent:alpha:main", updatedAt: 10 }),
    ];

    expect(resolveFirstSessionKeyForAgent(sessions, "beta")).toBeNull();
  });
});
