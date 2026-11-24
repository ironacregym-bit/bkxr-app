import { firestore } from "@pt/firebase";

import { sendEmail } from "../../email-engine/src/send-email";

import { getWelcomeTemplate } from "../../email-engine/src/templates/IronAcreGymWelcome";

import { completeWorkflowRun } from "./completeWorkflowRun";

export async function processWorkflowRun(
  workflowRunId: string
) {
  const workflowDoc =
    await firestore
      .collection("workflow_runs")
      .doc(workflowRunId)
      .get();

  if (!workflowDoc.exists) {
    throw new Error(
      "Workflow run not found"
    );
  }

  const workflow =
    workflowDoc.data();

  if (!workflow) {
    throw new Error(
      "Workflow payload missing"
    );
  }

  if (
    workflow.workflowId !==
    "lead-onboarding"
  ) {
    return;
  }

  const leadId =
    workflow.payload?.leadId;

  if (!leadId) {
    throw new Error(
      "Lead ID missing"
    );
  }

  const leadDoc =
    await firestore
      .collection(
        "iron-acre-web_leads"
      )
      .doc(String(leadId))
      .get();

  if (!leadDoc.exists) {
    throw new Error(
      "Lead not found"
    );
  }

  const lead =
    leadDoc.data();

  if (!lead) {
    throw new Error(
      "Lead data missing"
    );
  }

  const welcome =
    getWelcomeTemplate({
      firstName:
        lead.name ??
        "there",
    });

  await sendEmail({
    to: lead.email,

    subject:
      welcome.subject,

    html:
      welcome.html,
  });

  await leadDoc.ref.update({
    welcomeEmailSent: true,
    welcomeEmailSentAt:
      new Date(),
  });

  await completeWorkflowRun(
    workflowRunId
  );
}
