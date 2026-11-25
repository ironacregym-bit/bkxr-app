export function isAllowedRecipientDomain(
  recipient: string,
  allowedDomains: string[]
) {
  const domain = recipient.slice(recipient.lastIndexOf("@") + 1).toLowerCase();
  return allowedDomains.includes(domain);
}
