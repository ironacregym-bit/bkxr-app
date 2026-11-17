export function getCoachingTemplate({
  firstName,
}: {
  firstName: string;
}) {
  return {
    subject:
      "Coaching Application Received",

    html: `
      <h1>
        Application Received
      </h1>

      <p>
        Hi ${firstName},
      </p>

      <p>
        Thanks for applying for
        Iron Acre Online Coaching.
      </p>

      <p>
        I'll personally review your
        application and get back
        to you soon.
      </p>

      <p>
        Rob
      </p>
    `,
  };
}
