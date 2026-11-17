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
      return GetWelcomeTemplate(
        variables
      );

    case "coaching":
      return GetCoachingTemplate(
        variables
      );

    default:
      throw new Error(
        `Unknown template: ${template}`
      );
  }
}
