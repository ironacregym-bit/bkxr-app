export interface WorkflowRun {
  id?: string;

  tenantId: string;

  workflowId: string;

  status:
    | "pending"
    | "running"
    | "completed"
    | "failed";

  currentStep: number;

  payload: Record<
    string,
    unknown
  >;

  createdAt: Date;

  updatedAt: Date;
}
