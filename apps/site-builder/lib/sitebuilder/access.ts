export function isSiteOwner(site: any, email: string) {
  const ownerEmail = String(site?.owner_email || "").trim().toLowerCase();
  return Boolean(email && ownerEmail && ownerEmail === email.trim().toLowerCase());
}
