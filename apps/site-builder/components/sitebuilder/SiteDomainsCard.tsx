import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  normalizeCustomDomain,
  type DomainDnsTarget,
} from "@/lib/sitebuilder/domains";
import CollapsiblePanel from "./CollapsiblePanel";

type DomainRow = {
  host: string;
  status: "pending" | "verified" | "active" | string;
  dnsTargets?: DomainDnsTarget[];
  verification?: DomainVerificationChallenge[];
  ownershipRecord?: DomainVerificationChallenge;
  addedAt?: string;
  verifiedAt?: string;
};

type DomainVerificationChallenge = {
  domain: string;
  type: string;
  value: string;
};

type ListResp =
  | { ok: true; domains: DomainRow[] }
  | { ok: false; error: string; detail?: string };

type AddResp =
  | {
      ok: true;
      host: string;
      status: "pending" | "active";
      dnsTargets: DomainDnsTarget[];
      verification: DomainVerificationChallenge[];
      ownershipRecord?: DomainVerificationChallenge;
    }
  | { ok: false; error: string; detail?: string };

type VerifyResp =
  | {
      ok: true;
      host: string;
      status: "active";
      verification: DomainVerificationChallenge[];
    }
  | {
      ok: false;
      error: string;
      detail?: string;
      verification?: DomainVerificationChallenge[];
      ownershipRecord?: DomainVerificationChallenge;
    };

const fetcher = async (url: string): Promise<ListResp> => {
  const res = await fetch(url);
  return res.json();
};

export default function SiteDomainsCard(props: {
  siteId: string;
  canEdit: boolean;
  slug: string;
  onChanged: () => void;
}) {
  const { siteId, canEdit, onChanged } = props;

  const [host, setHost] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [latestVerification, setLatestVerification] = useState<{
    host: string;
    dnsTargets: DomainDnsTarget[];
    records: DomainVerificationChallenge[];
    ownershipRecord?: DomainVerificationChallenge;
  } | null>(null);

  async function refresh(): Promise<boolean> {
    setMsg(null);

    try {
      const resp = await fetcher(
        `/api/sitebuilder/domains/list?siteId=${encodeURIComponent(siteId)}`
      );

      if (resp.ok === false) {
        setMsg(resp.detail || "Could not load domains.");
        return false;
      }

      setDomains(resp.domains || []);
      return true;
    } catch {
      setMsg("Could not load domains.");
      return false;
    }
  }

  async function add() {
    setMsg(null);
    setLatestVerification(null);

    if (!canEdit) {
      setMsg("You don’t have permission to edit domains.");
      return;
    }

    const cleanHost = normalizeCustomDomain(host);
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

      if (!resp.ok || !json || json.ok === false) {
        setMsg(
          json?.ok === false
            ? json.detail || json.error
            : "Could not add domain."
        );
        setBusy(false);
        return;
      }

      setLatestVerification({
        host: json.host,
        dnsTargets: json.dnsTargets || [],
        records: json.verification || [],
        ownershipRecord: json.ownershipRecord,
      });
      const domainsLoaded = await refresh();
      if (domainsLoaded) {
        setMsg(
          json.status === "active"
            ? "Domain is verified and mapped to this site."
            : "Domain added. Configure the displayed DNS records and targets, then click Verify."
        );
      }
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

      if (!resp.ok || !json || json.ok === false) {
        if (
          json &&
          json.ok === false &&
          (json.verification || json.ownershipRecord)
        ) {
          const verification = json.verification;
          setLatestVerification({
            host: hostToVerify,
            dnsTargets:
              domains.find((domain) => domain.host === hostToVerify)
                ?.dnsTargets || [],
            records: verification || [],
            ownershipRecord: json.ownershipRecord,
          });
          setDomains((current) =>
            current.map((domain) =>
              domain.host === hostToVerify
                ? {
                    ...domain,
                    verification,
                    ownershipRecord: json.ownershipRecord,
                  }
                : domain
            )
          );
        }
        setMsg(
          json?.ok === false
            ? json.detail || json.error
            : "Could not verify domain yet."
        );
        setBusy(false);
        return;
      }

      setLatestVerification({
        host: hostToVerify,
        dnsTargets:
          domains.find((domain) => domain.host === hostToVerify)?.dnsTargets ||
          [],
        records: json.verification || [],
        ownershipRecord: undefined,
      });

      const domainsLoaded = await refresh();
      if (domainsLoaded) {
        setMsg(
          "Domain verified and mapped. Make sure its DNS points to Vercel."
        );
      }
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
      description="Add a customer domain, point its DNS to this Vercel project, then verify it here. Verified domains route to this site automatically."
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

        {msg ? (
          <div
            role="status"
            className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          >
            {msg}
          </div>
        ) : null}

        {latestVerification ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="font-semibold">
              DNS setup for {latestVerification.host}
            </div>
            <div className="text-xs leading-relaxed text-muted-foreground">
              Add the SiteBuilder ownership record and any Vercel verification
              records below at your DNS provider. Use the appropriate Vercel
              A or CNAME target shown here to route the domain; do not create
              conflicting A and CNAME records for the same name. Then click
              Verify.
            </div>
            {latestVerification.dnsTargets.length ? (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Vercel DNS targets
                </div>
                {latestVerification.dnsTargets.map((target, index) => (
                  <div
                    key={`${target.type}-${target.value}-${index}`}
                    className="break-all font-mono text-xs"
                  >
                    {target.type}: {latestVerification.host} → {target.value}
                    {target.rank === 1 ? " (recommended)" : ""}
                  </div>
                ))}
              </div>
            ) : null}
            {latestVerification.ownershipRecord ||
            latestVerification.records.length ? (
              <div className="space-y-3">
                {[
                  ...(latestVerification.ownershipRecord
                    ? [latestVerification.ownershipRecord]
                    : []),
                  ...latestVerification.records,
                ].map((record, index) => (
                  <div
                    key={`${record.domain}-${record.type}-${index}`}
                    className="grid gap-1 sm:grid-cols-[5rem_minmax(0,1fr)]"
                  >
                    <div className="text-xs font-medium text-muted-foreground">
                      {record.type}
                    </div>
                    <div className="break-all font-mono text-xs">
                      {record.domain} → {record.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No additional ownership-verification TXT records are required.
              </p>
            )}
            {!latestVerification.dnsTargets.length ? (
              <p className="text-xs text-muted-foreground">
                Vercel did not return DNS routing targets. Check the domain
                configuration in the Vercel project before continuing.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          {domains.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No domains added yet.
            </div>
          ) : null}

          {domains.map((domain) => (
            <div
              key={domain.host}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
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
                {domain.status !== "active" &&
                (domain.ownershipRecord ||
                  domain.verification?.length ||
                  domain.dnsTargets?.length) ? (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {(domain.dnsTargets || []).map((target, index) => (
                      <div
                        key={`${target.type}-${target.value}-${index}`}
                        className="break-all"
                      >
                        {target.type}: {domain.host} → {target.value}
                      </div>
                    ))}
                    {[
                      ...(domain.ownershipRecord
                        ? [domain.ownershipRecord]
                        : []),
                      ...(domain.verification || []),
                    ].map((record, index) => (
                      <div
                        key={`${record.domain}-${record.type}-${index}`}
                        className="break-all"
                      >
                        {record.type}: {record.domain} → {record.value}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => verify(domain.host)}
                  disabled={!canEdit || busy || domain.status === "active"}
                >
                  {domain.status === "active" ? "Active" : "Verify"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CollapsiblePanel>
  );
}
