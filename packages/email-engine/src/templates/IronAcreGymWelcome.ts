export function getWelcomeTemplate({
  firstName,
}: {
  firstName: string;
}) {
  const safeFirstName = firstName.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });

  return {
    subject:
      "Welcome To Iron Acre",

    html: `
      <h1>
        Welcome To Iron Acre
      </h1>

      <p>
        Hi ${safeFirstName},
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
