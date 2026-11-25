const placeholderPattern = /{{([A-Za-z][A-Za-z0-9_]{0,39})}}/g;

export type EmailTemplateContent = {
  subject: string;
  text: string;
};

export function getEmailTemplateVariables({
  subject,
  text,
}: EmailTemplateContent) {
  const source = `${subject}\n${text}`;
  const variables = new Set<string>();
  const remainder = source.replace(placeholderPattern, (_match, name: string) => {
    variables.add(name);
    return "";
  });

  if (remainder.includes("{{") || remainder.includes("}}")) {
    throw new Error("Email template contains an invalid placeholder.");
  }
  if (variables.size > 20) {
    throw new Error("Email templates may use at most 20 variables.");
  }

  return [...variables].sort();
}

export function renderEmailTemplate(
  template: EmailTemplateContent,
  variables: Record<string, string>
) {
  const requiredVariables = getEmailTemplateVariables(template);
  const suppliedVariables = Object.keys(variables).sort();

  if (
    requiredVariables.length !== suppliedVariables.length ||
    requiredVariables.some((name, index) => name !== suppliedVariables[index])
  ) {
    throw new Error(
      "Supply exactly the variables required by the approved email template."
    );
  }
  if (
    requiredVariables.some(
      (name) =>
        variables[name].length > 500 ||
        (template.subject.includes(`{{${name}}}`) &&
          /[\r\n]/.test(variables[name]))
    )
  ) {
    throw new Error("Email template variable is invalid.");
  }

  const render = (value: string) =>
    value.replace(
      placeholderPattern,
      (_match, name: string) => variables[name]
    );

  return {
    subject: render(template.subject),
    text: render(template.text),
  };
}
