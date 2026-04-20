import { normalizeLowercaseStringOrEmpty } from "../../string-coerce.ts";
import { parseAgentSessionKey } from "../../session-key.ts";
import type { CronJob, GatewaySessionRow } from "../../types.ts";

function normalizeAgentScopeId(agentId: string | null | undefined): string {
  return normalizeLowercaseStringOrEmpty(agentId) || "main";
}

export function filterSessionsForAgent(
  sessions: GatewaySessionRow[],
  currentAgentId: string,
): GatewaySessionRow[] {
  const normalizedAgentId = normalizeAgentScopeId(currentAgentId);
  return sessions.filter((session) => {
    const parsed = parseAgentSessionKey(session.key);
    if (parsed) {
      return normalizeAgentScopeId(parsed.agentId) === normalizedAgentId;
    }
    return normalizedAgentId === "main";
  });
}

export function resolveFirstSessionKeyForAgent(
  sessions: GatewaySessionRow[],
  currentAgentId: string,
): string | null {
  const firstSession = filterSessionsForAgent(
    sessions,
    currentAgentId,
  ).toSorted(
    (left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0),
  )[0];
  return firstSession?.key ?? null;
}

export function filterCronJobsForAgent(
  jobs: CronJob[],
  currentAgentId: string,
): CronJob[] {
  const normalizedAgentId = normalizeAgentScopeId(currentAgentId);
  return jobs.filter((job) => {
    const jobAgentId = normalizeLowercaseStringOrEmpty(job.agentId);
    if (jobAgentId) {
      return jobAgentId === normalizedAgentId;
    }
    return normalizedAgentId === "main";
  });
}
