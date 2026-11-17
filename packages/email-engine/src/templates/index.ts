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
      return getWelcomeTemplate(
        variables
      );

    case "coaching":
      return getCoachingTemplate(
        variables
      );

    default:
      throw new Error(
        `Unknown template: ${template}`
      );
  }
}
