// File: SiteBuilder/components/BuilderDashboard.tsx
import { useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/router";

type MineResp =
  | {
      ok: true;
      sites: Array<{
        id: string;
        slug: string;
        name: string;
        published: boolean;
        updated_at: string;
      }>;
    }
  | { ok: false; error: string; detail?: string };

type CreateResp =
  | { ok: true; siteId: string; slug: string }
  | { ok: false; error: string; detail?: string };

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function slugify(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function BuilderDashboard() {
  const router = useRouter();

  const { data, mutate, isLoading } = useSWR<MineResp>("/api/sitebuilder/mine", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  const sites = useMemo(() => {
    if (!data) return [];
    if ((data as any).ok !== true) return [];
    return ((data as any).sites || []) as Array<{
      id: string;
      slug: string;
      name: string;
      published: boolean;
      updated_at: string;
    }>;
  }, [data]);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);

    const cleanSlug = slugify(slug || name);
    if (!cleanSlug || cleanSlug.length < 3) {
      setError("Enter a name or slug (min 3 characters).");
      return;
    }

    setCreating(true);
    try {
      const resp = await fetch("/api/sitebuilder/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ name: name.trim(), slug: cleanSlug }),
      });

      const json = (await resp.json().catch(() => null)) as CreateResp | null;

      if (!resp.ok || !json || (json as any).ok !== true) {
        const code = (json as any)?.error || "CREATE_FAILED";
        const msg =
          code === "SLUG_TAKEN"
            ? "That slug is already taken."
            : (json as any)?.detail || "Could not create site.";
        setError(msg);
        setCreating(false);
        return;
      }

      await mutate();
      router.push(`/sitebuilder/${encodeURIComponent((json as any).siteId)}`);
    } catch {
      setError("Could not create site.");
      setCreating(false);
    }
  }

  const previewSlug = slugify(slug || name) || "your-slug";

  return (
    <div className="sb-wrap">
      <div className="sb-shell">
        <div className="sb-head">
          <div className="sb-title">SiteBuilder</div>
          <div className="sb-sub">Create and manage simple pages. One user can own many pages.</div>
        </div>

        <div className="sb-grid">
          <div className="sb-card">
            <div className="sb-cardTitle">Create a new site</div>

            <div className="sb-form">
              <input
                className="sb-input"
                placeholder="Site name (e.g. Acme Plumbing)"
                value={name}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  if (!slug) setSlug(slugify(v));
                }}
              />

              <input
                className="sb-input"
                placeholder="Slug (e.g. acme-plumbing)"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
              />

              {error ? <div className="sb-error">{error}</div> : null}

              <button className="sb-btn" onClick={create} disabled={creating}>
                {creating ? "Creating…" : "Create site"}
              </button>

              <div className="sb-hint">
                Your hosted URL will be <span className="sb-mono">/p/{previewSlug}</span>. You can add a custom domain in settings.
              </div>
            </div>
          </div>

          <div className="sb-card">
            <div className="sb-cardTitle">Your sites</div>

            {isLoading ? <div className="sb-muted">Loading…</div> : null}
            {!isLoading && (!sites || sites.length === 0) ? <div className="sb-muted">No sites yet. Create one.</div> : null}

            <div className="sb-list">
              {(sites || []).map((s) => (
                <div key={s.id} className="sb-row">
                  <div className="sb-rowMain">
                    <div className="sb-rowName">{String(s.name || "Untitled")}</div>
                    <div className="sb-rowMeta">
                      <span className="sb-mono">/p/{String(s.slug || "")}</span>
                      <span className="sb-dot" aria-hidden="true" />
                      <span className={s.published ? "sb-pill sb-pillOn" : "sb-pill"}>{s.published ? "Published" : "Draft"}</span>
                    </div>
                  </div>

                  <div className="sb-rowActions">
                    <button className="sb-link" onClick={() => router.push(`/p/${encodeURIComponent(s.slug)}`)}>
                      View
                    </button>
                    <button className="sb-link" onClick={() => router.push(`/sitebuilder/${encodeURIComponent(s.id)}`)}>
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="sb-note">
              Custom domains are served at the root via middleware mapping. When you add a client domain, you’ll also add it in Vercel and update the host map env.
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .sb-wrap {
          min-height: 100vh;
          background: #06090d;
          color: #fff;
          padding: 18px;
        }

        .sb-shell {
          max-width: 1100px;
          margin: 0 auto;
        }

        .sb-head {
          margin-bottom: 14px;
        }

        .sb-title {
          font-size: 22px;
          font-weight: 650;
          letter-spacing: -0.2px;
        }

        .sb-sub {
          margin-top: 8px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.45;
          font-weight: 450;
        }

        .sb-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 12px;
        }

        .sb-card {
          border-radius: 18px;
          background: #0b0f14;
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 16px;
        }

        .sb-cardTitle {
          font-weight: 650;
          font-size: 16px;
        }

        .sb-form {
          margin-top: 12px;
          display: grid;
          gap: 10px;
        }

        .sb-input {
          min-height: 46px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(7, 10, 15, 0.85);
          color: #fff;
          padding: 0 12px;
          outline: none;
        }

        .sb-input:focus {
          border-color: rgba(31, 224, 165, 0.55);
          box-shadow: 0 0 0 3px rgba(31, 224, 165, 0.12);
        }

        .sb-btn {
          min-height: 46px;
          border-radius: 14px;
          border: none;
          background: #1fe0a5;
          color: #061018;
          font-weight: 650;
          cursor: pointer;
        }

        .sb-btn:disabled {
          opacity: 0.7;
          cursor: default;
        }

        .sb-error {
          color: #ff6b6b;
          font-size: 14px;
        }

        .sb-hint {
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
          line-height: 1.35;
        }

        .sb-mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }

        .sb-muted {
          margin-top: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .sb-list {
          margin-top: 12px;
          display: grid;
          gap: 10px;
        }

        .sb-row {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(7, 10, 15, 0.45);
          padding: 12px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }

        .sb-rowName {
          font-weight: 650;
        }

        .sb-rowMeta {
          margin-top: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
        }

        .sb-dot {
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.35);
        }

        .sb-pill {
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.15);
          color: rgba(255, 255, 255, 0.75);
          font-weight: 600;
        }

        .sb-pillOn {
          border-color: rgba(31, 224, 165, 0.35);
          background: rgba(31, 224, 165, 0.12);
          color: rgba(255, 255, 255, 0.9);
        }

        .sb-rowActions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .sb-link {
          appearance: none;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.9);
          border-radius: 12px;
          padding: 10px 12px;
          min-height: 42px;
          font-weight: 600;
          cursor: pointer;
        }

        .sb-link:hover {
          border-color: rgba(255, 255, 255, 0.2);
        }

        .sb-note {
          margin-top: 12px;
          color: rgba(255, 255, 255, 0.55);
          font-size: 12px;
          line-height: 1.35;
        }

        @media (max-width: 920px) {
          .sb-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
