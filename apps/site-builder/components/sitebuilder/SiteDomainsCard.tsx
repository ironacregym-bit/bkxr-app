import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CollapsiblePanel from "./CollapsiblePanel";

type DomainRow = {
  host: string;
  status: "pending" | "verified" | "active" | string;
  verificationToken?: string;
  addedAt?: string;
  verifiedAt?: string;
};

type ListResp =
  | { ok: true; domains: DomainRow[] }
  | { ok: false; error: string; detail?: string };

type AddResp =
  | { ok: true; host: string; verificationToken: string; txtName: string; txtValue: string }
  | { ok: false; error: string; detail?: string };

type VerifyResp =
  | { ok: true; host: string; status: "verified" }
  | { ok: false; error: string; detail?: string };

const fetcher = async (url: string) => {
  const res = await fetch(url);
  return res.json();
};

function normalizeHost(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .split(":")[0];
}

export default function SiteDomainsCard(props: {
  siteId: string;
  canEdit: boolean;
  slug: string;
  onChanged: () => void;
}) {
  const { siteId, canEdit, slug, onChanged } = props;

  const [host, setHost] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [txtName, setTxtName] = useState<string | null>(null);
  const [txtValue, setTxtValue] = useState<string | null>(null);
  const [lastHost, setLastHost] = useState<string | null>(null);

  const [domains, setDomains] = useState<DomainRow[]>([]);

  const hostMapHint = useMemo(() => {
    const base = normalizeHost(lastHost || host);
    if (!base) return null;

    const www = base.startsWith("www.") ? base : `www.${base}`;

    return {
      base,
      www,
      jsonSnippet: `{\n  "${base}": "${slug}",\n  "${www}": "${slug}"\n}`,
    };
  }, [lastHost, host, slug]);

  async function refresh() {
    setMsg(null);

    try {
      const resp = (await fetcher(
        `/api/sitebuilder/domains/list?siteId=${encodeURIComponent(siteId)}`
      )) as ListResp;

      if (!resp || resp.ok !== true) {
        setMsg((resp as any)?.detail || "Could not load domains.");
        return;
      }

      setDomains(resp.domains || []);
    } catch {
      setMsg("Could not load domains.");
    }
  }

  async function add() {
    setMsg(null);
    setTxtName(null);
    setTxtValue(null);

    if (!canEdit) {
      setMsg("You don’t have permission to edit domains.");
      return;
    }

    const cleanHost = normalizeHost(host);
    if (!cleanHost) {
      setMsg("Enter a domain like example.com");
      return;
    }

    setBusy(true);

    try {
      const resp = await fetch("/api/sitebuilder/domains/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          siteId,
          host: cleanHost,
        }),
      });

      const json = (await resp.json().catch(() => null)) as AddResp | null;

      if (!resp.ok || !json || (json as any).ok !== true) {
        setMsg((json as any)?.detail || (json as any)?.error || "Could not add domain.");
        setBusy(false);
        return;
      }

      setLastHost((json as any).host);
      setTxtName((json as any).txtName);
      setTxtValue((json as any).txtValue);
      setMsg("Domain added. Add the TXT record, then click Verify.");

      await refresh();
      onChanged();
      setBusy(false);
    } catch {
      setMsg("Could not add domain.");
      setBusy(false);
    }
  }

  async function verify(hostToVerify: string) {
    setMsg(null);

    if (!canEdit) {
      setMsg("You don’t have permission to verify domains.");
      return;
    }

    setBusy(true);

    try {
      const resp = await fetch("/api/sitebuilder/domains/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          siteId,
          host: hostToVerify,
        }),
      });

      const json = (await resp.json().catch(() => null)) as VerifyResp | null;

      if (!resp.ok || !json || (json as any).ok !== true) {
        setMsg((json as any)?.detail || (json as any)?.error || "Could not verify domain yet.");
        setBusy(false);
        return;
      }

      setMsg("Verified. Next step: point DNS at Vercel and add host mapping.");
      setLastHost(hostToVerify);

      await refresh();
      onChanged();
      setBusy(false);
    } catch {
      setMsg("Could not verify domain yet.");
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!siteId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  return (
    <CollapsiblePanel
      title="Custom domains"
      description="Add a client domain, verify ownership via TXT, then map the host to this slug for root serving."
    >
      <div className="space-y-5">

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="example.com"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          disabled={!canEdit || busy}
        />

        <Button onClick={add} disabled={!canEdit || busy}>
          {busy ? "Working…" : "Add domain"}
        </Button>

        <Button variant="outline" onClick={refresh} disabled={busy}>
          Refresh
        </Button>
      </div>

      {msg ? <div role="status" className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{msg}</div> : null}

      {txtName && txtValue ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="font-semibold">TXT verification</div>

          <div className="grid gap-1 sm:grid-cols-[5rem_minmax(0,1fr)]">
            <div className="text-xs font-medium text-muted-foreground">Name</div>
            <div className="break-all font-mono text-xs">{txtName}</div>
          </div>

          <div className="grid gap-1 sm:grid-cols-[5rem_minmax(0,1fr)]">
            <div className="text-xs font-medium text-muted-foreground">Value</div>
            <div className="break-all font-mono text-xs">{txtValue}</div>
          </div>

          <div className="text-xs leading-relaxed text-muted-foreground">
            Add this TXT record in DNS, wait for propagation, then click Verify on the domain row below.
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {domains.length === 0 ? <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No domains added yet.</div> : null}

        {domains.map((domain) => (
          <div key={domain.host} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <div className="break-all font-medium">{domain.host}</div>

              <div className="mt-1">
                <span
                  className={
                    domain.status === "active"
                      ? "inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300"
                      : domain.status === "verified"
                      ? "inline-flex rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-300"
                      : "inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {domain.status}
                </span>
              </div>
            </div>

            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => verify(domain.host)}
                disabled={!canEdit || busy || domain.status === "verified" || domain.status === "active"}
              >
                Verify
              </Button>
            </div>
          </div>
        ))}
      </div>

      {hostMapHint ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="font-semibold">Host mapping (Vercel env)</div>

          <div className="text-xs leading-relaxed text-muted-foreground">
            After verification and once the domain is added to your Vercel project, add this mapping to{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">SITEBUILDER_HOSTS_JSON</code>.
          </div>

          <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-xs">{hostMapHint.jsonSnippet}</pre>

          <div className="text-xs leading-relaxed text-muted-foreground">
            This will serve the site at <code className="font-mono text-foreground">{hostMapHint.base}</code> and{" "}
            <code className="font-mono text-foreground">{hostMapHint.www}</code>.
          </div>
        </div>
      ) : null}


      </div>
    </CollapsiblePanel>
  );
}
