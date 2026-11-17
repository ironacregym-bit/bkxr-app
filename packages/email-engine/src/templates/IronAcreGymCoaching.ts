export function coachingTemplate(
  variables: Record<
    string,
    string | number
  >
) {
  return {
    subject:
      "Coaching Application Received",

    html: `
      <h1>
        Application Received
      </h1>

      <p>
        Hi ${variables.firstName},
      </p>

      <p>
        Thanks for applying
        for coaching.
      </p>

      <p>
        We will be in touch soon.
      </p>
    `,
  };
}
