export type SetupState = "ready" | "needs-admin" | "initializing";

export interface SetupStep {
  id: "secret" | "admin" | "configure";
  title: string;
  description: string;
  completed: boolean;
}

export interface SetupStatus {
  state: SetupState;
  secretConfigured: boolean;
  adminExists: boolean;
  steps: SetupStep[];
  curlExample: string;
  backgroundTask: {
    running: boolean;
    lastCompletedAt?: string;
  };
}
