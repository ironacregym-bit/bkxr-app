import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="sd-card">
      <div className="sd-title">Custom domains</div>
      <div className="sd-sub">
        Add a client domain, verify ownership via TXT, then map the host to this slug for root serving.
      </div>

      <div className="sd-form">
        <Input
          className="sd-input"
          placeholder="example.com"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          disabled={!canEdit || busy}
        />

        <Button className="sd-btn" onClick={add} disabled={!canEdit || busy}>
          {busy ? "Working…" : "Add domain"}
        </Button>

        <Button className="sd-btn sd-btnGhost" onClick={refresh} disabled={busy}>
          Refresh
        </Button>
      </div>

      {msg ? <div className="sd-msg">{msg}</div> : null}

      {txtName && txtValue ? (
        <div className="sd-instructions">
          <div className="sd-instructionsTitle">TXT verification</div>

          <div className="sd-monoRow">
            <div className="sd-monoLabel">Name</div>
            <div className="sd-monoValue">{txtName}</div>
          </div>

          <div className="sd-monoRow">
            <div className="sd-monoLabel">Value</div>
            <div className="sd-monoValue">{txtValue}</div>
          </div>

          <div className="sd-help">
            Add this TXT record in DNS, wait for propagation, then click Verify on the domain row below.
          </div>
        </div>
      ) : null}

      <div className="sd-list">
        {domains.length === 0 ? <div className="sd-muted">No domains added yet.</div> : null}

        {domains.map((domain) => (
          <div key={domain.host} className="sd-row">
            <div className="sd-rowLeft">
              <div className="sd-host">{domain.host}</div>

              <div className="sd-meta">
                <span
                  className={
                    domain.status === "active"
                      ? "sd-pill sd-pillOn"
                      : domain.status === "verified"
                      ? "sd-pill sd-pillMid"
                      : "sd-pill"
                  }
                >
                  {domain.status}
                </span>
              </div>
            </div>

            <div className="sd-rowRight">
              <Button
                className="sd-link"
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
        <div className="sd-instructions">
          <div className="sd-instructionsTitle">Host mapping (Vercel env)</div>

          <div className="sd-help">
            After verification and once the domain is added to your Vercel project, add this mapping to{" "}
            <span className="sd-monoInline">SITEBUILDER_HOSTS_JSON</span>.
          </div>

          <pre className="sd-pre">{hostMapHint.jsonSnippet}</pre>

          <div className="sd-help">
            This will serve the site at <span className="sd-monoInline">{hostMapHint.base}</span> and{" "}
            <span className="sd-monoInline">{hostMapHint.www}</span>.
          </div>
        </div>
      ) : null}


    </div>
  );
}
