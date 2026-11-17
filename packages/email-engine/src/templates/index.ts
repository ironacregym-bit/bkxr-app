import { getWelcomeTemplate } from "./IronAcreGymWelcome";
import { getCoachingTemplate } from "./IronAcreGymCoaching";

export function getTemplate(
  template: string,
  variables: Record<
    string,
    string | number
  >
) {
  switch (template) {
    case "welcome":
      return welcomeTemplate(
        variables
      );

    case "coaching":
      return coachingTemplate(
        variables
      );

    default:
      throw new Error(
        `Unknown template: ${template}`
      );
  }
}
