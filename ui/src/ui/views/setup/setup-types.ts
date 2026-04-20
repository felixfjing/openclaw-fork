export type SetupStep = "check" | "uv" | "skills" | "provider" | "complete";

export interface SetupWizardState {
  currentStep: SetupStep;
  uvInstalled: boolean;
  skillsDeployed: boolean;
  providerConfigured: boolean;
  completed: boolean;
  uvProgress: string | null;
  skillsProgress: string | null;
  providerError: string | null;
  gatewayUrl: string;
}

export const SETUP_STEPS: SetupStep[] = ["check", "uv", "skills", "provider", "complete"];

export function nextStep(current: SetupStep, state: SetupWizardState): SetupStep {
  const idx = SETUP_STEPS.indexOf(current);
  if (idx >= SETUP_STEPS.length - 1) return "complete";

  // 跳过已完成的步骤
  if (current === "check" && state.uvInstalled) return nextStep("uv", state);
  if (current === "uv" && state.uvInstalled) return nextStep("skills", state);
  if (current === "skills" && state.skillsDeployed) return nextStep("provider", state);
  if (current === "provider" && state.providerConfigured) return "complete";

  return SETUP_STEPS[idx + 1];
}
