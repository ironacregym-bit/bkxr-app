import { getWelcomeTemplate } from "./welcome";
import { getCoachingTemplate } from "./coaching";

export function getTemplate(
  template: string,
  variables: Record<
    string,
    string | number
  >
) {
  switch (template) {
    case "welcome":
      return getWelcomeTemplate({
        firstName: String(
          variables.firstName ?? ""
        ),
      });

    case "coaching":
      return getCoachingTemplate({
        firstName: String(
          variables.firstName ?? ""
        ),
      });

    default:
      throw new Error(
        `Unknown template: ${template}`
      );
  }
}
