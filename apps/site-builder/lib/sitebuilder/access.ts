export type SiteAccessRecord = {
  owner_email?: unknown;
  editor_emails?: unknown;
};

export function isSiteOwner(site: SiteAccessRecord, email: string) {
  const ownerEmail = String(site?.owner_email || "").trim().toLowerCase();
  return Boolean(email && ownerEmail && ownerEmail === email.trim().toLowerCase());
}

export function canEditSite(site: SiteAccessRecord, email: string) {
  if (isSiteOwner(site, email)) return true;
  const normalizedEmail = email.trim().toLowerCase();
  const editors = Array.isArray(site.editor_emails) ? site.editor_emails : [];
  return Boolean(
    normalizedEmail &&
      editors.some(
        (editor) =>
          typeof editor === "string" &&
          editor.trim().toLowerCase() === normalizedEmail
      )
  );
}
