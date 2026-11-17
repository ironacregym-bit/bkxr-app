import { sendEmail } from "./send-email";

import {
  getTemplate,
} from "./templates";

export async function sendTemplate({
  template,
  to,
  variables,
}: {
  template: string;
  to: string;
  variables: Record<
    string,
    string | number
  >;
}) {
  const tpl =
    getTemplate(
      template,
      variables
    );

  return sendEmail({
    to,
    subject: tpl.subject,
    html: tpl.html,
  });
}
