import type {
  ApprovedEmailRequest,
  ApprovedEmailResponse,
} from "./approved-email";

export async function sendApprovedEmail(
  _input: ApprovedEmailRequest & {
    serviceUrl: string;
    apiKey: string;
  }
): Promise<ApprovedEmailResponse> {
  throw new Error("sendApprovedEmail is only available in server code.");
}
