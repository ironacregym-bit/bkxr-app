export interface WorkflowRun {
  id?: string;

  tenantId: string;

  workflowId: string;

  status:
    | "pending"
    | "running"
    | "completed"
    | "failed";

  payload: Record<
    string,
    unknown
  >;

  createdAt: Date;

  updatedAt: Date;
}
