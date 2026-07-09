// File: SiteBuilder/components/SiteEditor.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";
import SiteDomainsCard from "./SiteDomainsCard";
import SiteEditorsCard from "./SiteEditorsCard";
import ImageUploadField from "./ImageUploadField";
import ImageGalleryBuilder from "./ImageGalleryBuilder";
import CustomTableBuilder from "./CustomTableBuilder";

type GetResp =
  | { ok: true; site: any; canEdit: boolean }
  | { ok: false; error: string; detail?: string };

type UpdateResp =
  | { ok: true; site: any }
  | { ok: false; error: string; detail?: string };

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function safeStr(v: any) {
  return String(v || "").trim();
}

function makeCloudinaryFaviconUrl(url: string) {
  const clean = safeStr(url);
  if (!clean) return "";

  if (clean.includes("res.cloudinary.com") && clean.includes("/image/upload/")) {
    return clean.replace("/image/upload/", "/image/upload/c_fill,w_64,h_64,r_max,f_png,q_auto/");
  }

  return clean;
}

function normaliseGallery(site: any) {
  return {
    title: safeStr(site?.mediaGallery?.title) || "Gallery",
    intro: safeStr(site?.mediaGallery?.intro),
    images: Array.isArray(site?.mediaGallery?.images) ? site.mediaGallery.images : [],
  };
}

function normaliseTables(site: any) {
  const raw = site?.customTables;

  if (Array.isArray(raw)) {
    return raw;
  }

  if (!raw || typeof raw !== "object") {
    return [];
  }

  const order = Array.isArray(raw.order) ? raw.order : [];
  const items = raw.items && typeof raw.items === "object" ? raw.items : {};

  return order
    .map((tableId: string) => {
      const table = items[tableId];
      if (!table || typeof table !== "object") return null;

      const columnOrder = Array.isArray(table.columnOrder) ? table.columnOrder : [];
      const columnsMap = table.columns && typeof table.columns === "object" ? table.columns : {};

      const columns = columnOrder.map((columnId: string) => String(columnsMap[columnId] || "").trim());

      const rowOrder = Array.isArray(table.rowOrder) ? table.rowOrder : [];
      const rowsMap = table.rows && typeof table.rows === "object" ? table.rows : {};

      const rows = rowOrder.map((rowId: string) => {
        const row = rowsMap[rowId] || {};
        const cells = row.cells && typeof row.cells === "object" ? row.cells : {};

        return columnOrder.map((columnId: string) => String(cells[columnId] || "").trim());
      });

      return {
        id: String(table.id || tableId),
        title: String(table.title || ""),
        intro: String(table.intro || ""),
        columns,
        rows,
      };
    })
    .filter(Boolean);
}

export default function SiteEditor() {
  const router = useRouter();
  const siteId = useMemo(() => safeStr(router.query.siteId), [router.query.siteId]);

  const { data, mutate, isLoading } = useSWR<GetResp>(
    siteId ? `/api/sitebuilder/get?siteId=${encodeURIComponent(siteId)}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10_000 }
  );

  const canEdit = Boolean((data as any)?.ok && (data as any)?.canEdit);
  const site = (data as any)?.ok ? (data as any).site : null;

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(null);

  useEffect(() => {
    if (!site) return;

    setDraft((prev: any) => {
      if (prev) return prev;

      return {
        published: Boolean(site.published),
        brand: {
          name: safeStr(site?.brand?.name),
          logoUrl: safeStr(site?.brand?.logoUrl),
          faviconUrl: safeStr(site?.brand?.faviconUrl),
        },
        theme: {
          accent: safeStr(site?.theme?.accent) || "#1fe0a5",
          mode: safeStr(site?.theme?.mode) === "light" ? "light" : "dark",
        },
        seo: {
          title: safeStr(site?.seo?.title),
          description: safeStr(site?.seo?.description),
          image: safeStr(site?.seo?.image),
        },
        hero: {
          headline: safeStr(site?.hero?.headline),
          subheadline: safeStr(site?.hero?.subheadline),
          imageUrl: safeStr(site?.hero?.imageUrl),
          ctaText: safeStr(site?.hero?.ctaText),
          ctaHref: safeStr(site?.hero?.ctaHref),
        },
        sections: {
          about: safeStr(site?.sections?.about),
          services: safeStr(site?.sections?.services),
          faq: safeStr(site?.sections?.faq),
          contact: safeStr(site?.sections?.contact),
        },
        mediaGallery: normaliseGallery(site),
        customTables: normaliseTables(site),
      };
    });
  }, [site]);

  function setLogoUrl(url: string) {
    setDraft((p: any) => {
      const nextLogo = safeStr(url);
      const currentFavicon = safeStr(p?.brand?.faviconUrl);
      const previousLogo = safeStr(p?.brand?.logoUrl);
      const previousAutoFavicon = makeCloudinaryFaviconUrl(previousLogo);

      const shouldAutoUpdateFavicon =
        !currentFavicon || currentFavicon === previousLogo || currentFavicon === previousAutoFavicon;

      return {
        ...p,
        brand: {
          ...p.brand,
          logoUrl: nextLogo,
          faviconUrl: shouldAutoUpdateFavicon ? makeCloudinaryFaviconUrl(nextLogo) : currentFavicon,
        },
      };
    });
  }

  function autoBuildFaviconFromLogo() {
    setDraft((p: any) => ({
      ...p,
      brand: {
        ...p.brand,
        faviconUrl: makeCloudinaryFaviconUrl(p?.brand?.logoUrl),
      },
    }));
  }

  async function save() {
    setMsg(null);

    if (!siteId) return;

    if (!canEdit) {
      setMsg("You don’t have permission to edit this site.");
      return;
    }

    setSaving(true);

    try {
      const resp = await fetch("/api/sitebuilder/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ siteId, patch: draft }),
      });

      const json = (await resp.json().catch(() => null)) as UpdateResp | null;

      if (!resp.ok || !json || (json as any).ok !== true) {
        setMsg((json as any)?.detail || "Could not save changes.");
        setSaving(false);
        return;
      }

      setMsg("Saved.");
      await mutate();
      setSaving(false);
    } catch {
      setMsg("Could not save changes.");
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#06090d", color: "#fff", padding: 18 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>Loading…</div>
      </div>
    );
  }

  if (!data || (data as any).ok !== true) {
    return (
      <div style={{ minHeight: "100vh", background: "#06090d", color: "#fff", padding: 18 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontWeight: 650, fontSize: 18 }}>Could not load site</div>
          <div style={{ marginTop: 10, color: "rgba(255,255,255,0.7)" }}>
            {(data as any)?.detail || (data as any)?.error || "Unknown error"}
          </div>
          <div style={{ marginTop: 14 }}>
            <button
              className="ia-btn ia-btn-outline"
              style={{ borderRadius: 14, minHeight: 46, padding: "10px 14px" }}
              onClick={() => router.push("/sitebuilder")}
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div style={{ minHeight: "100vh", background: "#06090d", color: "#fff", padding: 18 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>Preparing editor…</div>
      </div>
    );
  }

  const publicUrl = `/p/${encodeURIComponent(String(site.slug || ""))}`;

  return (
    <div className="se-wrap">
      <div className="se-shell">
        <div className="se-top">
          <div className="se-title">
            Edit site
            <span className="se-slug">/p/{String(site.slug || "")}</span>
          </div>

          <div className="se-actions">
            <button
              className="ia-btn ia-btn-outline"
              style={{ borderRadius: 14, minHeight: 46, padding: "10px 14px" }}
              onClick={() => router.push("/sitebuilder")}
            >
              Dashboard
            </button>

            <button
              className="ia-btn ia-btn-outline"
              style={{ borderRadius: 14, minHeight: 46, padding: "10px 14px" }}
              onClick={() => router.push(publicUrl)}
            >
              View
            </button>

            <button
              className="ia-btn ia-btn-primary"
              style={{ borderRadius: 14, minHeight: 46, padding: "10px 14px" }}
              disabled={saving}
              onClick={save}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {msg ? <div className="se-msg">{msg}</div> : null}

        {!canEdit ? (
          <div className="se-card">
            <div className="se-cardTitle">Read only</div>
            <div className="se-help">You can view this site but you don’t have permission to edit it.</div>
          </div>
        ) : null}

        <div className="se-grid">
          <div className="se-card">
            <div className="se-cardTitle">Publishing</div>

            <label className="se-check">
              <input
                type="checkbox"
                checked={Boolean(draft.published)}
                onChange={(e) => setDraft((p: any) => ({ ...p, published: e.target.checked }))}
              />
              <span>Published (public)</span>
            </label>

            <div className="se-help">
              Draft sites are only visible to you (owner/editors). The public will see a 404 until you publish.
            </div>
          </div>

          <SiteDomainsCard
            siteId={String(site.id)}
            canEdit={canEdit}
            slug={String(site.slug || "")}
            onChanged={() => mutate()}
          />

          <SiteEditorsCard siteId={String(site.id)} onChanged={() => mutate()} />

          <div className="se-card se-span2">
            <div className="se-cardTitle">Brand</div>

            <div className="se-two">
              <div className="se-field">
                <div className="se-label">Name</div>
                <input
                  className="se-input"
                  value={draft.brand.name}
                  onChange={(e) =>
                    setDraft((p: any) => ({
                      ...p,
                      brand: { ...p.brand, name: e.target.value },
                    }))
                  }
                />
              </div>

              <div className="se-field">
                <div className="se-label">Theme mode</div>
                <select
                  className="se-input"
                  value={draft.theme.mode}
                  onChange={(e) =>
                    setDraft((p: any) => ({
                      ...p,
                      theme: { ...p.theme, mode: e.target.value },
                    }))
                  }
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>
            </div>

            <ImageUploadField
              label="Logo"
              value={draft.brand.logoUrl}
              onChange={setLogoUrl}
              folder="sitebuilder/logos"
              helpText="Upload a logo or paste a public image URL. The favicon can be generated from this logo."
            />

            <div className="se-faviconRow">
              <div className="se-faviconPreview">
                {draft.brand.faviconUrl ? <img src={draft.brand.faviconUrl} alt="" /> : <span>No favicon</span>}
              </div>

              <button type="button" className="se-smallBtn" onClick={autoBuildFaviconFromLogo}>
                Auto-build favicon from logo
              </button>
            </div>

            <div className="se-field">
              <div className="se-label">Favicon URL</div>
              <input
                className="se-input"
                value={draft.brand.faviconUrl}
                onChange={(e) =>
                  setDraft((p: any) => ({
                    ...p,
                    brand: { ...p.brand, faviconUrl: e.target.value },
                  }))
                }
                placeholder="Auto-filled from logo, or paste custom favicon URL"
              />
              <div className="se-help">
                This is saved now. To show it publicly, wire it into the public renderer Head as the icon link.
              </div>
            </div>

            <div className="se-field">
              <div className="se-label">Accent</div>
              <input
                className="se-input"
                value={draft.theme.accent}
                onChange={(e) =>
                  setDraft((p: any) => ({
                    ...p,
                    theme: { ...p.theme, accent: e.target.value },
                  }))
                }
                placeholder="#1fe0a5"
              />
            </div>
          </div>

          <div className="se-card se-span2">
            <div className="se-cardTitle">Hero</div>

            <div className="se-two">
              <div className="se-field">
                <div className="se-label">Headline</div>
                <input
                  className="se-input"
                  value={draft.hero.headline}
                  onChange={(e) =>
                    setDraft((p: any) => ({
                      ...p,
                      hero: { ...p.hero, headline: e.target.value },
                    }))
                  }
                />
              </div>

              <div className="se-field">
                <div className="se-label">CTA</div>
                <input
                  className="se-input"
                  value={draft.hero.ctaText}
                  onChange={(e) =>
                    setDraft((p: any) => ({
                      ...p,
                      hero: { ...p.hero, ctaText: e.target.value },
                    }))
                  }
                  placeholder="Get in touch"
                />
              </div>
            </div>

            <div className="se-field">
              <div className="se-label">Subheadline</div>
              <textarea
                className="se-textarea"
                value={draft.hero.subheadline}
                onChange={(e) =>
                  setDraft((p: any) => ({
                    ...p,
                    hero: { ...p.hero, subheadline: e.target.value },
                  }))
                }
                rows={3}
              />
            </div>

            <ImageUploadField
              label="Hero image"
              value={draft.hero.imageUrl}
              onChange={(url) =>
                setDraft((p: any) => ({
                  ...p,
                  hero: { ...p.hero, imageUrl: url },
                }))
              }
              folder="sitebuilder/heroes"
              helpText="Upload a hero image or paste a public image URL."
            />

            <div className="se-field">
              <div className="se-label">CTA link</div>
              <input
                className="se-input"
                value={draft.hero.ctaHref}
                onChange={(e) =>
                  setDraft((p: any) => ({
                    ...p,
                    hero: { ...p.hero, ctaHref: e.target.value },
                  }))
                }
                placeholder="#contact or https://..."
              />
            </div>
          </div>

          <div className="se-card se-span2">
            <div className="se-cardTitle">Sections</div>

            <div className="se-field">
              <div className="se-label">About</div>
              <textarea
                className="se-textarea"
                value={draft.sections.about}
                onChange={(e) =>
                  setDraft((p: any) => ({
                    ...p,
                    sections: { ...p.sections, about: e.target.value },
                  }))
                }
                rows={6}
              />
              <div className="se-help">Use blank lines to separate paragraphs.</div>
            </div>

            <div className="se-field">
              <div className="se-label">Services</div>
              <textarea
                className="se-textarea"
                value={draft.sections.services}
                onChange={(e) =>
                  setDraft((p: any) => ({
                    ...p,
                    sections: { ...p.sections, services: e.target.value },
                  }))
                }
                rows={6}
              />
            </div>

            <div className="se-field">
              <div className="se-label">FAQ</div>
              <textarea
                className="se-textarea"
                value={draft.sections.faq}
                onChange={(e) =>
                  setDraft((p: any) => ({
                    ...p,
                    sections: { ...p.sections, faq: e.target.value },
                  }))
                }
                rows={6}
              />
            </div>

            <div className="se-field">
              <div className="se-label">Contact</div>
              <textarea
                className="se-textarea"
                value={draft.sections.contact}
                onChange={(e) =>
                  setDraft((p: any) => ({
                    ...p,
                    sections: { ...p.sections, contact: e.target.value },
                  }))
                }
                rows={5}
              />
              <div className="se-help">One item per line: Email, Phone, Instagram, Address etc.</div>
            </div>
          </div>

          <div className="se-card se-span2">
            <CustomTableBuilder
              value={draft.customTables}
              onChange={(value) =>
                setDraft((p: any) => ({
                  ...p,
                  customTables: value,
                }))
              }
            />
          </div>
          <div className="se-card se-span2">
            <ImageGalleryBuilder
              value={draft.mediaGallery}
              onChange={(value) =>
                setDraft((p: any) => ({
                  ...p,
                  mediaGallery: value,
                }))
              }
            />
          </div>

          <div className="se-card se-span2">
            <div className="se-cardTitle">SEO</div>

            <div className="se-two">
              <div className="se-field">
                <div className="se-label">Title</div>
                <input
                  className="se-input"
                  value={draft.seo.title}
                  onChange={(e) =>
                    setDraft((p: any) => ({
                      ...p,
                      seo: { ...p.seo, title: e.target.value },
                    }))
                  }
                />
              </div>

              <div className="se-field">
                <div className="se-label">OG Image URL</div>
                <input
                  className="se-input"
                  value={draft.seo.image}
                  onChange={(e) =>
                    setDraft((p: any) => ({
                      ...p,
                      seo: { ...p.seo, image: e.target.value },
                    }))
                  }
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="se-field">
              <div className="se-label">Description</div>
              <textarea
                className="se-textarea"
                value={draft.seo.description}
                onChange={(e) =>
                  setDraft((p: any) => ({
                    ...p,
                    seo: { ...p.seo, description: e.target.value },
                  }))
                }
                rows={3}
              />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .se-wrap {
          min-height: 100vh;
          background: #06090d;
          color: #fff;
          padding: 18px;
        }

        .se-shell {
          max-width: 1100px;
          margin: 0 auto;
        }

        .se-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .se-title {
          font-size: 20px;
          font-weight: 650;
          letter-spacing: -0.2px;
          display: flex;
          gap: 10px;
          align-items: baseline;
          flex-wrap: wrap;
        }

        .se-slug {
          color: rgba(255, 255, 255, 0.6);
          font-weight: 450;
          font-size: 13px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
            monospace;
        }

        .se-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .se-msg {
          margin-bottom: 12px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(7, 10, 15, 0.5);
          color: rgba(255, 255, 255, 0.85);
        }

        .se-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .se-span2 {
          grid-column: span 2;
        }

        .se-card {
          border-radius: 18px;
          background: #0b0f14;
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 16px;
        }

        .se-cardTitle {
          font-weight: 650;
          font-size: 16px;
        }

        .se-field {
          margin-top: 12px;
        }

        .se-label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .se-input {
          width: 100%;
          min-height: 44px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(7, 10, 15, 0.85);
          color: #fff;
          padding: 0 12px;
          outline: none;
        }

        .se-textarea {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(7, 10, 15, 0.85);
          color: #fff;
          padding: 10px 12px;
          outline: none;
          resize: vertical;
          line-height: 1.5;
        }

        .se-input:focus,
        .se-textarea:focus {
          border-color: rgba(31, 224, 165, 0.55);
          box-shadow: 0 0 0 3px rgba(31, 224, 165, 0.12);
        }

        .se-check {
          margin-top: 12px;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          color: rgba(255, 255, 255, 0.82);
          font-weight: 450;
        }

        .se-help {
          margin-top: 8px;
          color: rgba(255, 255, 255, 0.55);
          font-size: 12px;
          line-height: 1.35;
        }

        .se-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .se-faviconRow {
          margin-top: 12px;
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .se-faviconPreview {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          background: rgba(7, 10, 15, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          color: rgba(255, 255, 255, 0.45);
          font-size: 11px;
          text-align: center;
          padding: 4px;
        }

        .se-faviconPreview img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .se-smallBtn {
          min-height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.18);
          color: rgba(255, 255, 255, 0.92);
          font-weight: 600;
          cursor: pointer;
          padding: 10px 12px;
        }

        @media (max-width: 920px) {
          .se-grid {
            grid-template-columns: 1fr;
          }

          .se-span2 {
            grid-column: span 1;
          }

          .se-two {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
