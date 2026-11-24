import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ListResp =
  | {
      ok: true;
      owner_email: string;
      editor_emails: string[];
      canManage: boolean;
    }
  | { ok: false; error: string; detail?: string };

type UpdateResp =
  | {
      ok: true;
      owner_email: string;
      editor_emails: string[];
    }
  | { ok: false; error: string; detail?: string };

const fetcher = async (url: string) => {
  const res = await fetch(url);
  return res.json();
};

function toLower(v: string) {
  return String(v || "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function SiteEditorsCard(props: {
  siteId: string;
  onChanged: () => void;
}) {
  const { siteId, onChanged } = props;

  const [ownerEmail, setOwnerEmail] = useState("");
  const [editorEmails, setEditorEmails] = useState<string[]>([]);
  const [canManage, setCanManage] = useState(false);

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setMsg(null);

    try {
      const resp = (await fetcher(
        `/api/sitebuilder/editors/list?siteId=${encodeURIComponent(siteId)}`
      )) as ListResp;

      if (!resp || resp.ok !== true) {
        setMsg((resp as any)?.detail || "Could not load access list.");
        return;
      }

      setOwnerEmail(resp.owner_email || "");
      setEditorEmails(resp.editor_emails || []);
      setCanManage(Boolean(resp.canManage));
    } catch {
      setMsg("Could not load access list.");
    }
  }

  async function addEditor() {
    setMsg(null);

    const target = toLower(email);
    if (!target || !isValidEmail(target)) {
      setMsg("Enter a valid email address.");
      return;
    }

    setBusy(true);

    try {
      const resp = await fetch("/api/sitebuilder/editors/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          siteId,
          action: "add",
          email: target,
        }),
      });

      const json = (await resp.json().catch(() => null)) as UpdateResp | null;

      if (!resp.ok || !json || (json as any).ok !== true) {
        setMsg((json as any)?.detail || (json as any)?.error || "Could not add editor.");
        setBusy(false);
        return;
      }

      setEmail("");
      setOwnerEmail((json as any).owner_email || "");
      setEditorEmails((json as any).editor_emails || []);
      setMsg("Access added.");
      onChanged();
      setBusy(false);
    } catch {
      setMsg("Could not add editor.");
      setBusy(false);
    }
  }

  async function removeEditor(targetEmail: string) {
    setMsg(null);
    setBusy(true);

    try {
      const resp = await fetch("/api/sitebuilder/editors/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          siteId,
          action: "remove",
          email: targetEmail,
        }),
      });

      const json = (await resp.json().catch(() => null)) as UpdateResp | null;

      if (!resp.ok || !json || (json as any).ok !== true) {
        setMsg((json as any)?.detail || (json as any)?.error || "Could not remove editor.");
        setBusy(false);
        return;
      }

      setOwnerEmail((json as any).owner_email || "");
      setEditorEmails((json as any).editor_emails || []);
      setMsg("Access removed.");
      onChanged();
      setBusy(false);
    } catch {
      setMsg("Could not remove editor.");
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!siteId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  return (
    <div className="sc-card">
      <div className="sc-title">Editors</div>
      <div className="sc-sub">
        Add client emails here and they’ll be able to log in and edit this site from their own SiteBuilder dashboard.
      </div>

      {msg ? <div className="sc-msg">{msg}</div> : null}

      <div className="sc-section">
        <div className="sc-label">Owner</div>
        <div className="sc-owner">{ownerEmail || "—"}</div>
      </div>

      <div className="sc-section">
        <div className="sc-label">Editors with access</div>

        {editorEmails.length === 0 ? <div className="sc-muted">No editors added yet.</div> : null}

        <div className="sc-list">
          {editorEmails.map((item) => (
            <div key={item} className="sc-row">
              <div className="sc-email">{item}</div>

              <Button
                className="sc-link"
                onClick={() => removeEditor(item)}
                disabled={!canManage || busy}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="sc-section">
        <div className="sc-label">Add editor</div>

        <div className="sc-form">
          <Input
            className="sc-input"
            placeholder="client@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!canManage || busy}
          />

          <Button className="sc-btn" onClick={addEditor} disabled={!canManage || busy}>
            {busy ? "Working…" : "Add access"}
          </Button>
        </div>

        {!canManage ? (
          <div className="sc-help">
            Only the site owner can manage editor access.
          </div>
        ) : (
          <div className="sc-help">
            Once added, that email can log in and this site will appear in their dashboard automatically.
          </div>
        )}
      </div>


    </div>
  );
}
