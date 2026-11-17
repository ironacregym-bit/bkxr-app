export function getWelcomeTemplate({
  firstName,
}: {
  firstName: string;
}) {
  return {
    subject:
      "Welcome To Iron Acre",

    html: `
      <h1>
        Welcome To Iron Acre
      </h1>

      <p>
        Hi ${firstName},
      </p>

      <p>
        Thanks for joining Iron Acre.
      </p>

      <p>
        We will be sending your free
        7 day programme shortly.
      </p>

      <p>
        Speak soon,
        <br />
        Rob
      </p>
    `,
  };
}
