export function welcomeTemplate(
  variables: Record<
    string,
    string | number
  >
) {
  return {
    subject:
      "Welcome To Iron Acre Gym",

    html: `
      <h1>
        Welcome to Iron Acre Gym
      </h1>

      <p>
        Hi ${variables.firstName},
      </p>

      <p>
        Thanks for joining.
      </p>

      <p>
        Your free 7 day program
        is on the way.
      </p>
    `,
  };
}
