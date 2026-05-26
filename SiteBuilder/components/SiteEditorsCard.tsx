// File: SiteBuilder/components/SiteEditorsCard.tsx
import { useEffect, useState } from "react";

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

              <button
                className="sc-link"
                onClick={() => removeEditor(item)}
                disabled={!canManage || busy}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="sc-section">
        <div className="sc-label">Add editor</div>

        <div className="sc-form">
          <input
            className="sc-input"
            placeholder="client@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!canManage || busy}
          />

          <button className="sc-btn" onClick={addEditor} disabled={!canManage || busy}>
            {busy ? "Working…" : "Add access"}
          </button>
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

      <style jsx>{`
        .sc-card {
          border-radius: 18px;
          background: #0b0f14;
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 16px;
        }

        .sc-title {
          font-weight: 650;
          font-size: 16px;
        }

        .sc-sub {
          margin-top: 8px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.45;
          font-weight: 450;
        }

        .sc-msg {
          margin-top: 10px;
          color: rgba(255, 255, 255, 0.85);
          font-weight: 450;
        }

        .sc-section {
          margin-top: 14px;
        }

        .sc-label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .sc-owner {
          color: rgba(255, 255, 255, 0.92);
          font-weight: 600;
        }

        .sc-muted {
          color: rgba(255, 255, 255, 0.55);
          font-size: 13px;
        }

        .sc-list {
          display: grid;
          gap: 8px;
        }

        .sc-row {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(7, 10, 15, 0.45);
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .sc-email {
          color: rgba(255, 255, 255, 0.9);
          font-weight: 500;
          word-break: break-word;
        }

        .sc-form {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: center;
        }

        .sc-input {
          min-height: 44px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(7, 10, 15, 0.85);
          color: #fff;
          padding: 0 12px;
          outline: none;
        }

        .sc-input:focus {
          border-color: rgba(31, 224, 165, 0.55);
          box-shadow: 0 0 0 3px rgba(31, 224, 165, 0.12);
        }

        .sc-btn {
          min-height: 44px;
          border-radius: 12px;
          border: none;
          background: #1fe0a5;
          color: #061018;
          font-weight: 650;
          cursor: pointer;
          padding: 0 14px;
        }

        .sc-btn:disabled {
          opacity: 0.7;
          cursor: default;
        }

        .sc-link {
          appearance: none;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.9);
          border-radius: 12px;
          padding: 10px 12px;
          min-height: 40px;
          font-weight: 600;
          cursor: pointer;
        }

        .sc-link:disabled {
          opacity: 0.6;
          cursor: default;
        }

        .sc-help {
          margin-top: 8px;
          color: rgba(255, 255, 255, 0.55);
          font-size: 12px;
          line-height: 1.35;
        }

        @media (max-width: 720px) {
          .sc-form {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
