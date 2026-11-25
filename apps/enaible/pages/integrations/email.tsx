import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, Copy, Mail, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type EmailApiKey = {
  keyId: string;
  name: string;
  allowedRecipientDomains: string[];
  createdAt: string;
  revokedAt: string | null;
};

type EmailTemplate = {
  templateId: string;
  name: string;
  subject: string;
  text: string;
  variables: string[];
  status: "approved" | "revoked";
  createdAt: string;
  revokedAt: string | null;
};

type Organization = {
  name: string;
  role: string;
};

export default function EmailIntegrationPage() {
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [keys, setKeys] = useState<EmailApiKey[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [keyName, setKeyName] = useState("");
  const [allowedDomains, setAllowedDomains] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateText, setTemplateText] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [appOrigin, setAppOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const activeResponse = await fetch("/api/organizations/active");
      if (activeResponse.status === 401) {
        await router.replace("/login");
        return;
      }
      if (!activeResponse.ok) {
        const result = await activeResponse.json();
        throw new Error(result.error || "Select an organisation first.");
      }
      const activeResult = await activeResponse.json();
      setOrganization(activeResult.organization);

      const [keyResponse, templateResponse] = await Promise.all([
        fetch("/api/email/keys"),
        fetch("/api/email/templates"),
      ]);
      const [keyResult, templateResult] = await Promise.all([
        keyResponse.json(),
        templateResponse.json(),
      ]);
      if (!keyResponse.ok) {
        throw new Error(keyResult.error || "Could not load email API keys");
      }
      if (!templateResponse.ok) {
        throw new Error(templateResult.error || "Could not load email templates");
      }
      setKeys(keyResult.keys);
      setTemplates(templateResult.templates);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load email settings"
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    setAppOrigin(window.location.origin);
    void loadData();
  }, [loadData]);

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/email/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName,
          allowedRecipientDomains: allowedDomains
            .split(",")
            .map((domain) => domain.trim())
            .filter(Boolean),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create API key");
      setNewApiKey(result.apiKey);
      setKeyName("");
      setAllowedDomains("");
      setNotice("API key created. Copy it now; it will not be shown again.");
      await loadData();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Could not create API key"
      );
    } finally {
      setSaving(false);
    }
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/email/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          subject: templateSubject,
          text: templateText,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not approve template");
      setTemplateName("");
      setTemplateSubject("");
      setTemplateText("");
      setNotice("Approved email template created.");
      await loadData();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not approve template"
      );
    } finally {
      setSaving(false);
    }
  }

  async function revoke(kind: "keys" | "templates", id: string) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        kind === "keys" ? "/api/email/keys" : "/api/email/templates",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            kind === "keys" ? { keyId: id } : { templateId: id }
          ),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not revoke item");
      setNotice(kind === "keys" ? "API key revoked." : "Template revoked.");
      await loadData();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error ? revokeError.message : "Could not revoke item"
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyApiKey() {
    try {
      await navigator.clipboard.writeText(newApiKey);
      setNotice("API key copied.");
    } catch {
      setError("Clipboard access failed. Select and copy the key manually.");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading email settings...
      </main>
    );
  }

  const canManage =
    organization?.role === "owner" ||
    organization?.role === "administrator" ||
    organization?.role === "platform_admin";

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-5 py-8 md:px-8">
      <Link
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        href="/"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to EnAible
      </Link>

      <div>
        <p className="mb-2 text-sm font-medium text-primary">
          {organization?.name || "Email integration"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Email & MCP</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Create tenant-approved plain-text templates and scoped keys. The same
          key works with the email API and the remote MCP endpoint.
        </p>
      </div>

      {error && (
        <div
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm"
          role="status"
        >
          {notice}
        </div>
      )}

      {!canManage && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          You need an owner or administrator role to manage templates and API keys.
        </div>
      )}

      {newApiKey && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Copy your new API key</CardTitle>
            <CardDescription>
              It is shown once only. Store it as a server-side secret, never in a
              browser bundle or source control.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Input aria-label="New API key" readOnly value={newApiKey} />
            <Button onClick={copyApiKey} type="button" variant="outline">
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Approved templates</CardTitle>
            <CardDescription>
              Saving a template approves its fixed subject and plain-text body.
              Use {"{{variableName}}"} placeholders for values supplied at send
              time; recipients cannot provide arbitrary message content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {canManage && (
              <form className="space-y-3" onSubmit={createTemplate}>
                <Input
                  maxLength={60}
                  minLength={2}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="Template name"
                  required
                  value={templateName}
                />
                <Input
                  maxLength={160}
                  onChange={(event) => setTemplateSubject(event.target.value)}
                  placeholder="Subject, e.g. Welcome, {{firstName}}"
                  required
                  value={templateSubject}
                />
                <textarea
                  className="min-h-36 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  maxLength={8000}
                  onChange={(event) => setTemplateText(event.target.value)}
                  placeholder={"Plain-text message. Example:\nHi {{firstName}},\n\nThanks for getting in touch."}
                  required
                  value={templateText}
                />
                <Button disabled={saving} type="submit">
                  <Plus className="h-4 w-4" />
                  Approve template
                </Button>
              </form>
            )}

            <div className="space-y-3">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No templates yet. Create one before sending email.
                </p>
              ) : (
                templates.map((template) => (
                  <div
                    className="rounded-lg border border-border p-3"
                    key={template.templateId}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{template.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {template.status === "approved" ? "Approved" : "Revoked"}
                          {template.variables.length
                            ? ` · Variables: ${template.variables.join(", ")}`
                            : " · No variables"}
                        </p>
                        <p className="mt-2 text-sm">{template.subject}</p>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                          {template.text}
                        </p>
                      </div>
                      {canManage && template.status === "approved" && (
                        <Button
                          aria-label={`Revoke ${template.name}`}
                          disabled={saving}
                          onClick={() => revoke("templates", template.templateId)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API keys</CardTitle>
            <CardDescription>
              Every key belongs to this organisation, is shown only once, and
              can send only to its exact allowlisted recipient domains. Daily
              limit: 20 send attempts per key per UTC day. Failed SMTP
              attempts also count against the limit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {canManage && (
              <form className="space-y-3" onSubmit={createKey}>
                <Input
                  maxLength={60}
                  minLength={2}
                  onChange={(event) => setKeyName(event.target.value)}
                  placeholder="Key name, e.g. EnAible agent"
                  required
                  value={keyName}
                />
                <Input
                  onChange={(event) => setAllowedDomains(event.target.value)}
                  placeholder="Allowed domains, comma-separated"
                  required
                  value={allowedDomains}
                />
                <p className="text-xs text-muted-foreground">
                  Exact domains only, for example example.com. Subdomains need
                  their own entry.
                </p>
                <Button disabled={saving} type="submit">
                  <Plus className="h-4 w-4" />
                  Create API key
                </Button>
              </form>
            )}

            <div className="space-y-3">
              {keys.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No API keys have been created.
                </p>
              ) : (
                keys.map((key) => (
                  <div
                    className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                    key={key.keyId}
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{key.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {key.revokedAt ? "Revoked" : "Active"} ·{" "}
                        {key.allowedRecipientDomains.join(", ")}
                      </p>
                    </div>
                    {canManage && !key.revokedAt && (
                      <Button
                        aria-label={`Revoke ${key.name}`}
                        disabled={saving}
                        onClick={() => revoke("keys", key.keyId)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Connection details
          </CardTitle>
          <CardDescription>
            Configure these on a server-side app or MCP client using the key
            generated above.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <p className="mb-2 flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4 text-primary" />
              MCP server
            </p>
            <code className="break-all text-xs">
              {appOrigin ? `${appOrigin}/api/mcp` : "/api/mcp"}
            </code>
            <p className="mt-2 text-xs text-muted-foreground">
              Streamable HTTP; authenticate with the API key as a Bearer token.
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="mb-2 font-medium">Email API</p>
            <code className="break-all text-xs">
              POST /api/email/send
            </code>
            <p className="mt-2 text-xs text-muted-foreground">
              Apps can use the server-only{" "}
              <code>@pt/email-engine</code> client or call the API directly.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
