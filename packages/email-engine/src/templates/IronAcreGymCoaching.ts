export function getCoachingTemplate({
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
      "Coaching Application Received",

    html: `
      <h1>
        Application Received
      </h1>

      <p>
        Hi ${safeFirstName},
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
