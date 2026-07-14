// File: pages/p/[slug].tsx 
import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]";
import firestore from "../../lib/firestoreClient";
import { renderRichText } from "../../lib/sitebuilder/renderRichText";

type PublicSite = {
  id: string;
  slug: string;
  published: boolean;
  owner_email: string;
  editor_emails: string[];
  updated_at?: string;
  mediaGallery?: MediaGallery;
  theme?: {
    accent?: string | null;
    mode?: "dark" | "light" | string;
  };
  seo?: {
    title?: string;
    description?: string;
    image?: string | null;
  };
  brand?: {
    name?: string;
    logoUrl?: string | null;
    faviconUrl?: string | null;
  };
  hero?: {
    headline?: string;
    subheadline?: string;
    imageUrl?: string | null;
    ctaText?: string;
    ctaHref?: string;
  };
  sections?: {
    about?: string;
    services?: string;
    faq?: string;
    contact?: string;
  };
  customTables?: CustomTable[] | {
  order?: string[];
  items?: Record<string, any>;
};
};
type GalleryImage = {
  id?: string;
  imageUrl?: string | null;
  title?: string;
  caption?: string;
  alt?: string;
};

type MediaGallery = {
  title?: string;
  intro?: string;
  images?: GalleryImage[];
};
type CustomTable = {
  id?: string;
  title?: string;
  intro?: string;
  columns?: string[];
  rows?: string[][];
};

function normalizeHost(host: string) {
  return String(host || "").trim().toLowerCase().split(":")[0];
}

function safeText(v: any) {
  return String(v || "").trim();
}

function splitParagraphs(v: any) {
  const s = safeText(v);
  if (!s) return [];
  return s
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);
}
function normaliseGallery(site: PublicSite) {
  const gallery = site?.mediaGallery || {};
  const imagesRaw = Array.isArray(gallery.images) ? gallery.images : [];

  const images = imagesRaw
    .map((image, index) => ({
      id: safeText(image?.id) || `gallery_${index}`,
      imageUrl: safeText(image?.imageUrl),
      title: safeText(image?.title),
      caption: safeText(image?.caption),
      alt: safeText(image?.alt),
    }))
    .filter((image) => image.imageUrl);

  return {
    title: safeText(gallery.title) || "Gallery",
    intro: safeText(gallery.intro),
    images,
  };
}
function normaliseTables(site: PublicSite) {
  const raw = (site as any)?.customTables;
  if (Array.isArray(raw)) {
    return raw
      .map((table: any, tableIndex: number) => {
        const columns = Array.isArray(table?.columns)
          ? table.columns.map((column: any) => safeText(column)).filter(Boolean)
          : [];
        const rowsRaw = Array.isArray(table?.rows) ? table.rows : [];
        const rows = rowsRaw
          .map((row: any) => {
            const rowArray = Array.isArray(row) ? row : [];
            return columns.map((column: string, columnIndex: number) => safeText(rowArray[columnIndex]));
          })
          .filter((row: string[]) => row.some(Boolean));
        return {
          id: safeText(table?.id) || `table_${tableIndex}`,
          title: safeText(table?.title),
          intro: safeText(table?.intro),
          columns,
          rows,
        };
      })
      .filter((table: any) => table.title || table.rows.length > 0);
  }
  if (!raw || typeof raw !== "object") {
    return [];
  }
  const order = Array.isArray(raw.order) ? raw.order : [];
  const items = raw.items && typeof raw.items === "object" ? raw.items : {};
  return order
    .map((tableId: string, tableIndex: number) => {
      const table = items[tableId];
      if (!table || typeof table !== "object") return null;
      const columnOrder = Array.isArray(table.columnOrder) ? table.columnOrder : [];
      const columnsMap = table.columns && typeof table.columns === "object" ? table.columns : {};
      const columns = columnOrder
        .map((columnId: string) => safeText(columnsMap[columnId]))
        .filter(Boolean);
      const rowOrder = Array.isArray(table.rowOrder) ? table.rowOrder : [];
      const rowsMap = table.rows && typeof table.rows === "object" ? table.rows : {};
      const rows = rowOrder
        .map((rowId: string) => {
          const row = rowsMap[rowId] || {};
          const cells = row.cells && typeof row.cells === "object" ? row.cells : {};
          return columnOrder.map((columnId: string) => safeText(cells[columnId]));
        })
        .filter((row: string[]) => row.some(Boolean));
      return {
        id: safeText(table?.id) || safeText(tableId) || `table_${tableIndex}`,
        title: safeText(table?.title),
        intro: safeText(table?.intro),
        columns,
        rows,
      };
    })
    .filter((table: any) => table && (table.title || table.rows.length > 0));
}

function renderContactLine(line: string, accent: string) {
  const lower = line.toLowerCase();

  if (lower.startsWith("email:")) {
    const email = line.replace(/email:/i, "").trim();

    return (
      <>
        Email:{" "}
        <a
        href={`mailto:${email}`}
        className="sb-contactLink"
        style={{ color: accent }}>
          {email}
        </a>
      </>
    );
  }

  if (lower.startsWith("phone:")) {
    const phone = line.replace(/phone:/i, "").trim();

    return (
      <>
        Phone:{" "}
        <a
          href={`tel:${phone}`}
          className="sb-contactLink"
          style={{ color: accent }}
        >
          {phone}
        </a>
      </>
    );
  }

  if (lower.startsWith("instagram:")) {
    const handle = line.replace(/instagram:/i, "").trim();

    return (
      <>
        Instagram:{" "}
        <a
          href={`https://instagram.com/${handle.replace(/^@/, "")}`}
          target="_blank"
          rel="noreferrer"
          className="sb-contactLink"
          style={{ color: accent }}
        >
          {handle}
        </a>
      </>
    );
  }

  if (lower.startsWith("address:")) {
    const address = line.replace(/address:/i, "").trim();

    return (
      <>
        Address:{" "}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
          target="_blank"
          rel="noreferrer"
          className="sb-contactLink"
          style={{ color: accent }}
        >
          {address}
        </a>
      </>
    );
  }

  return line;
}

function isAuthorized(site: PublicSite, email: string) {
  const e = String(email || "").toLowerCase();
  if (!e) return false;
  if (String(site.owner_email || "").toLowerCase() === e) return true;
  const editors = Array.isArray(site.editor_emails) ? site.editor_emails : [];
  return editors.map((x) => String(x || "").toLowerCase()).includes(e);
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const slug = String(context.params?.slug || "").toLowerCase().trim();
  if (!slug) return { notFound: true };

  const session = await getServerSession(context.req, context.res, authOptions);
  const email = session?.user?.email ? String(session.user.email).toLowerCase() : "";

  const host = normalizeHost(String(context.req.headers.host || ""));
  const baseHost = normalizeHost(String(process.env.SITEBUILDER_BASE_HOST || ""));

  try {
    const slugSnap = await firestore.collection("sitebuilder_slugs").doc(slug).get();
    if (!slugSnap.exists) return { notFound: true };

    const slugData: any = slugSnap.data() || {};
    const siteId = String(slugData.siteId || "").trim();
    if (!siteId) return { notFound: true };

    const siteSnap = await firestore.collection("sitebuilder_sites").doc(siteId).get();
    if (!siteSnap.exists) return { notFound: true };

    const site = siteSnap.data() as PublicSite;
    const canEdit = isAuthorized(site, email);
    const published = Boolean(site.published);

    // Drafts are visible only to owner/editors
    if (!published && !canEdit) return { notFound: true };

    return {
      props: {
        site: { ...(site as any), id: siteId, slug },
        canEdit,
        servedHost: host,
        isCustomDomain: Boolean(host && baseHost && host !== baseHost),
      },
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[p/[slug]] SSR failed:", e);
    return { notFound: true };
  }
};

export default function PublicSitePage(props: {
  site: PublicSite;
  canEdit: boolean;
  servedHost: string;
  isCustomDomain: boolean;
}) {
  const { site, canEdit, isCustomDomain } = props;

  const accent = site?.theme?.accent || "#1fe0a5";
  const mode = String(site?.theme?.mode || "dark").toLowerCase() === "light" ? "light" : "dark";
  const isLight = mode === "light";

  const title = safeText(site?.seo?.title) || safeText(site?.brand?.name) || "Site";
  const description = safeText(site?.seo?.description) || "";
  const ogImage = site?.seo?.image || site?.hero?.imageUrl || null;

  const brandName = safeText(site?.brand?.name) || "Site";
  const logoUrl = site?.brand?.logoUrl || null;
  
  const faviconUrl =
    safeText(site?.brand?.faviconUrl) ||
    safeText(site?.brand?.logoUrl) ||
    "";

const faviconHref = faviconUrl
  ? `${faviconUrl}?v=${encodeURIComponent(site.updated_at || Date.now().toString())}`
  : "";

  const heroHeadline = safeText(site?.hero?.headline) || brandName;
  const heroSub = safeText(site?.hero?.subheadline) || "";
  const heroImage = site?.hero?.imageUrl || null;

  const ctaText = safeText(site?.hero?.ctaText) || "Get started";
  const ctaHref = safeText(site?.hero?.ctaHref) || "#contact";

  const aboutContent = site?.sections?.about || "";
  const servicesContent = site?.sections?.services || "";
  const faqContent = site?.sections?.faq || "";

  const contactLines = safeText(site?.sections?.contact)
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  const gallery = normaliseGallery(site);
  const hasGallery = gallery.images.length > 0;
  const customTables = normaliseTables(site);
  const hasTables = customTables.length > 0;
  const isDraft = !Boolean(site.published);

  const addressLine = contactLines.find((line) =>
    line.toLowerCase().startsWith("address:")
  );
  
  const addressValue = addressLine
    ? addressLine.replace(/address:/i, "").trim()
    : "";

  const bg = isLight ? "#ffffff" : "#06090d";
  const text = isLight ? "#111318" : "#ffffff";
  const muted = isLight ? "rgba(17,19,24,0.68)" : "rgba(255,255,255,0.70)";
  const border = isLight ? "rgba(17,19,24,0.08)" : "rgba(255,255,255,0.06)";
  const cardBg = isLight ? "#f6f7f9" : "#0b0f14";
  const topBg = isLight ? "rgba(255,255,255,0.82)" : "rgba(6,9,13,0.82)";
  const heroOverlay = isLight
    ? "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.72) 100%)"
    : "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.75) 100%)";

  const markBg = `linear-gradient(135deg, ${accent}, rgba(110, 168, 255, 0.75))`;

  return (
    <>
      <Head>
        <title>{title}</title>
        {description ? <meta name="description" content={description} /> : null}
        <meta property="og:title" content={title} />
        {description ? <meta property="og:description" content={description} /> : null}
        <meta property="og:type" content="website" />
        {ogImage ? <meta property="og:image" content={String(ogImage)} /> : null}
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {faviconHref ? (
          <>
            {faviconHref}
            {faviconHref}
            {faviconHref}
          </>
        ) : null}
      </Head>

      <div className="sb-wrap">
        {canEdit && isDraft ? (
          <div className="sb-draftBanner" role="status" aria-label="Draft banner">
            <div className="sb-draftDot" aria-hidden="true" />
            <div className="sb-draftText">
              Draft page. Only you and editors can see this. Publish it in settings when ready.
            </div>
            <div className="sb-draftActions">
              <Link className="sb-draftLink" href={`/sitebuilder/${encodeURIComponent(String(site.id))}`}>
                Open settings
              </Link>
            </div>
          </div>
        ) : null}

        <header className="sb-top">
          <div className="sb-brand">
            {logoUrl ? (
              <img src={logoUrl} alt={`${brandName} logo`} className="sb-logo" />
            ) : (
              <div className="sb-mark" aria-hidden="true" />
            )}
            <div className="sb-brandText">{brandName}</div>
          </div>

          <div className="sb-actions">
            {canEdit ? (
              <Link className="sb-edit" href={`/sitebuilder/${encodeURIComponent(String(site.id))}`}>
                Edit
              </Link>
            ) : null}
          </div>
        </header>

        <main className="sb-main">
          <section className="sb-hero">
            {heroImage ? (
              <div className="sb-heroMedia" aria-hidden="true">
                <img src={heroImage} alt="" className="sb-heroImg" />
                <div className="sb-heroOverlay" aria-hidden="true" />
              </div>
            ) : null}

            <div className="sb-heroInner">
              <h1 className="sb-h1">{heroHeadline}</h1>

              {heroSub ? <p className="sb-lead">{heroSub}</p> : null}

              <div className="sb-ctaRow">
                <a className="sb-cta" href={ctaHref}>
                  {ctaText}
                </a>
                <a className="sb-ctaGhost" href="#about">
                  Learn more
                </a>
              </div>
            </div>
          </section>

          <section id="about" className="sb-section">
            <h2 className="sb-h2">About</h2>
            {aboutContent ? (
              <div className="sb-body">
                {renderRichText(aboutContent)}
              </div>
            ) : (
              <div className="sb-muted">No content yet.</div>
            )}
          </section>

          <section id="services" className="sb-section">
            <h2 className="sb-h2">Services</h2>
            {servicesContent ? (
              <div className="sb-body">
                {renderRichText(servicesContent)}
              </div>
            ) : (
              <div className="sb-muted">No content yet.</div>
            )}
          </section>

          {hasTables ? (
          <section id="tables" className="sb-section">
            <h2 className="sb-h2">Information</h2>
            <div className="sb-tableList">
              {customTables.map((table: any) => (
                <div key={table.id} className="sb-tableBlock">
                  {table.title ? <h3 className="sb-h3">{table.title}</h3> : null}
                  {table.intro ? <p className="sb-sectionIntro">{table.intro}</p> : null}
                  {table.columns.length > 0 && table.rows.length > 0 ? (
                    <div className="sb-tableScroll">
                      <table className="sb-table">
                        <thead>
                          <tr>
                            {table.columns.map((column: string, columnIndex: number) => (
                              <th key={`${table.id}_head_${columnIndex}`}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row: string[], rowIndex: number) => (
                            <tr key={`${table.id}_row_${rowIndex}`}>
                              {table.columns.map((column: string, columnIndex: number) => (
                                <td key={`${table.id}_cell_${rowIndex}_${columnIndex}`}>
                                  {row[columnIndex] || "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="sb-muted">No table entries yet.</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {hasGallery ? (
          <section id="gallery" className="sb-section">
            <h2 className="sb-h2">{gallery.title}</h2>
        
            {gallery.intro ? (
              <p className="sb-sectionIntro">{gallery.intro}</p>
            ) : null}
        
            <div className="sb-galleryGrid">
              {gallery.images.map((image) => (
                <figure key={image.id} className="sb-galleryItem">
                  <div className="sb-galleryMedia">
                    <img
                      src={image.imageUrl || ""}
                      alt={image.alt || image.title || ""}
                      className="sb-galleryImg"
                    />
                  </div>
        
                  {image.title || image.caption ? (
                    <figcaption className="sb-galleryCaption">
                      {image.title ? (
                        <div className="sb-galleryTitle">{image.title}</div>
                      ) : null}
        
                      {image.caption ? (
                        <div className="sb-galleryText">{image.caption}</div>
                      ) : null}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          </section>
        ) : null}
          <section id="faq" className="sb-section">
            <h2 className="sb-h2">FAQ</h2>
            {faqContent ? (
              <div className="sb-body">
                {renderRichText(faqContent)}
              </div>
            ) : (
              <div className="sb-muted">No content yet.</div>
            )}
          </section>

          <section id="contact" className="sb-section">
            <h2 className="sb-h2">Contact</h2>
          
            {contactLines.length ? (
              <>
                <div className="sb-body">
                  {contactLines.map((line, i) => (
                    <div key={i} className="sb-line">
                      {renderContactLine(line, accent)}
                    </div>
                  ))}
                </div>
          
                {addressValue ? (
                  <div className="sb-mapCard">
                    <iframe
                      title="Location map"
                      src={`https://www.google.com/maps?q=${encodeURIComponent(addressValue)}&output=embed`}
                      loading="lazy"
                      className="sb-map"
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="sb-muted">No contact details yet.</div>
            )}
          </section>

          <footer className="sb-foot">
            <div className="sb-footInner">
              <div className="sb-footText">{isCustomDomain ? "" : "Powered by SiteBuilder"}</div>
              <div className="sb-footText">© {new Date().getFullYear()}</div>
            </div>
          </footer>
        </main>

        <style jsx>{`
          .sb-wrap {
            min-height: 100vh;
            background: ${bg};
            color: ${text};
          }

          .sb-draftBanner {
            position: sticky;
            top: 0;
            z-index: 40;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 18px;
            background: rgba(255, 170, 0, 0.12);
            border-bottom: 1px solid rgba(255, 170, 0, 0.22);
            backdrop-filter: blur(8px);
          }

          .sb-draftDot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: rgba(255, 170, 0, 0.9);
            box-shadow: 0 0 0 4px rgba(255, 170, 0, 0.15);
          }

          .sb-draftText {
            flex: 1;
            color: ${isLight ? "rgba(17,19,24,0.86)" : "rgba(255,255,255,0.86)"};
            font-weight: 500;
            line-height: 1.3;
            font-size: 13px;
          }

          .sb-draftActions {
            display: flex;
            gap: 10px;
          }

          .sb-draftLink {
            color: ${isLight ? "rgba(17,19,24,0.92)" : "rgba(255,255,255,0.92)"};
            text-decoration: underline;
            text-underline-offset: 3px;
            font-weight: 600;
            padding: 8px 10px;
            border-radius: 10px;
            border: 1px solid ${border};
            background: rgba(0, 0, 0, 0.04);
            min-height: 36px;
            display: inline-flex;
            align-items: center;
          }

          .sb-top {
            position: sticky;
            top: ${canEdit ? (isDraft ? "44px" : "0px") : "0px"};
            z-index: 20;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 14px 18px;
            background: ${topBg};
            border-bottom: 1px solid ${border};
            backdrop-filter: blur(10px);
          }

          .sb-brand {
            display: flex;
            align-items: center;
            gap: 10px;
            min-height: 44px;
            min-width: 0;
          }

          .sb-logo {
            width: 34px;
            height: 34px;
            border-radius: 10px;
            object-fit: cover;
          }

          .sb-mark {
            width: 34px;
            height: 34px;
            border-radius: 10px;
            background: ${markBg};
            box-shadow: 0 12px 28px rgba(31, 224, 165, 0.18);
          }

          .sb-brandText {
            font-weight: 650;
            letter-spacing: 0.2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 50vw;
          }

          .sb-edit {
            color: ${isLight ? "rgba(17,19,24,0.85)" : "rgba(255,255,255,0.85)"};
            text-decoration: none;
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid ${border};
            background: rgba(0, 0, 0, 0.04);
            font-weight: 600;
            min-height: 44px;
            display: inline-flex;
            align-items: center;
          }

          .sb-main {
            max-width: 980px;
            margin: 0 auto;
            padding: 18px;
          }

          .sb-hero {
            border-radius: 18px;
            overflow: hidden;
            border: 1px solid ${border};
            background: ${isLight
              ? `radial-gradient(900px 420px at 20% 15%, rgba(31,224,165,0.10), transparent 55%), radial-gradient(900px 420px at 75% 0%, rgba(110,168,255,0.10), transparent 60%), #f6f7f9`
              : `radial-gradient(900px 420px at 20% 15%, rgba(31,224,165,0.14), transparent 55%), radial-gradient(900px 420px at 75% 0%, rgba(110,168,255,0.14), transparent 60%), #0b0f14`};
            position: relative;
            min-height: 360px;
          }

          .sb-heroMedia {
            position: absolute;
            inset: 0;
          }

          .sb-heroImg {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: 50% 55%;
            display: block;
            filter: saturate(1.05) contrast(1.05);
          }

          .sb-heroOverlay {
            position: absolute;
            inset: 0;
            background: ${heroOverlay};
          }

          .sb-heroInner {
            position: relative;
            z-index: 2;
            padding: 22px;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            min-height: 360px;
          }

          .sb-h1 {
            margin: 0;
            font-size: 44px;
            line-height: 1.05;
            font-weight: 700;
            letter-spacing: -0.4px;
            text-shadow: ${isLight ? "none" : "0 14px 40px rgba(0, 0, 0, 0.55)"};
          }

          .sb-lead {
            margin: 12px 0 0 0;
            color: ${isLight ? "rgba(17,19,24,0.78)" : "rgba(255,255,255,0.8)"};
            line-height: 1.5;
            max-width: 720px;
            font-weight: 450;
          }

          .sb-ctaRow {
            margin-top: 16px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
          }

          .sb-cta {
            background: ${accent};
            color: #061018;
            text-decoration: none;
            font-weight: 650;
            border-radius: 14px;
            padding: 12px 16px;
            min-height: 46px;
            display: inline-flex;
            align-items: center;
          }

          .sb-ctaGhost {
            background: rgba(0, 0, 0, 0.04);
            border: 1px solid ${border};
            color: ${isLight ? "rgba(17,19,24,0.88)" : "rgba(255,255,255,0.88)"};
            text-decoration: none;
            font-weight: 600;
            border-radius: 14px;
            padding: 12px 16px;
            min-height: 46px;
            display: inline-flex;
            align-items: center;
          }

          .sb-section {
            margin-top: 16px;
            border-radius: 18px;
            border: 1px solid ${border};
            background: ${cardBg};
            padding: 18px;
          }

          .sb-h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 650;
            letter-spacing: -0.2px;
          }

          .sb-body {
            margin-top: 10px;
          }

          .sb-p {
            margin: 0 0 10px 0;
            color: ${muted};
            line-height: 1.55;
            font-weight: 450;
          }

          .sb-line {
            color: ${muted};
            line-height: 1.55;
            font-weight: 450;
            margin-top: 6px;
          }

          .sb-muted {
            margin-top: 10px;
            color: ${isLight ? "rgba(17,19,24,0.52)" : "rgba(255,255,255,0.55)"};
            font-weight: 450;
          }
          .sb-sectionIntro {
            margin: 10px 0 0 0;
            color: ${muted};
            line-height: 1.55;
          }
          
          .sb-galleryGrid {
            margin-top: 14px;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
          }
          
          .sb-galleryItem {
            margin: 0;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid ${border};
            background: ${cardBg};
          }
          
          .sb-galleryMedia {
            aspect-ratio: 4 / 3;
            overflow: hidden;
          }
          
          .sb-galleryImg {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          
          .sb-galleryCaption {
            padding: 12px;
          }
          
          .sb-galleryTitle {
            font-weight: 650;
          }
          
          .sb-galleryText {
            margin-top: 5px;
            color: ${muted};
            font-size: 13px;
          }
          .sb-h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 650;
            letter-spacing: -0.15px;
          }
          .sb-tableList {
            margin-top: 14px;
            display: grid;
            gap: 14px;
          }
          .sb-tableBlock {
            border-radius: 16px;
            border: 1px solid ${border};
            background: ${isLight ? "#ffffff" : "rgba(7,10,15,0.45)"};
            padding: 14px;
          }
          .sb-tableScroll {
            margin-top: 12px;
            overflow-x: auto;
            border-radius: 14px;
            border: 1px solid ${border};
          }
          .sb-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .sb-table th,
          .sb-table td {
            padding: 12px;
            text-align: left;
            vertical-align: top;
            border-bottom: 1px solid ${border};
            word-break: break-word;
          }
          .sb-table th {
            background: ${isLight ? "rgba(17,19,24,0.035)" : "rgba(255,255,255,0.04)"};
            color: ${isLight ? "rgba(17,19,24,0.82)" : "rgba(255,255,255,0.82)"};
            font-size: 13px;
            line-height: 1.35;
            font-weight: 700;
          }
          .sb-table td {
            color: ${muted};
            line-height: 1.45;
            font-weight: 450;
          }
          .sb-table tbody tr:last-child td {
            border-bottom: none;
          }
          .sb-foot {
            margin-top: 18px;
            padding: 18px 0 24px 0;
          }

          .sb-footInner {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            color: ${isLight ? "rgba(17,19,24,0.45)" : "rgba(255,255,255,0.5)"};
            font-size: 12px;
          }

          .sb-footText {
            min-height: 18px;
          }
          .sb-richH2 {
            margin: 20px 0 12px;
            font-size: 22px;
            font-weight: 700;
            color: inherit;
          }
          
          .sb-richH3 {
            margin: 18px 0 10px;
            font-size: 18px;
            font-weight: 650;
            color: inherit;
          }
          
          .sb-richH4 {
            margin: 16px 0 8px;
            font-size: 15px;
            font-weight: 650;
            color: inherit;
          }
          
          .sb-richParagraph {
            margin: 0 0 12px;
            color: ${muted};
            line-height: 1.65;
          }
          
          .sb-richList {
            margin: 0 0 16px 20px;
            padding: 0;
            color: ${muted};
          }
          
          .sb-richList li {
            margin-bottom: 8px;
            line-height: 1.6;
          }
          
          .sb-richNumbered {
            list-style: decimal;
          }
          .sb-contactLink,
          .sb-contactLink:visited,
          .sb-contactLink:active {
            text-decoration: underline !important;
            text-underline-offset: 3px;
            font-weight: 500;
          }
          
          .sb-contactLink:hover {
            opacity: 0.75;
          }
          .sb-mapCard {
            display: block;
            margin-top: 16px;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid ${border};
          }
          
          .sb-map {
            display: block;
            width: 100%;
            height: 320px;
            border: 0;
          }
          

          @media (max-width: 720px) {
            .sb-h1 {
              font-size: 38px;
            }

            .sb-brandText {
              max-width: 60vw;
            }

            .sb-draftBanner {
              padding: 10px 12px;
            }

            .sb-top {
              padding: 12px;
            }
            .sb-galleryGrid {
              grid-template-columns: 1fr;
            }
            .sb-tableBlock {
              padding: 12px;
            }
            .sb-table th,
            .sb-table td {
              padding: 10px;
            }
          }
          
        `}</style>
        <style jsx global>{`
          html,
          body,
          #__next {
            padding-bottom: 0 !important;
            margin-bottom: 0 !important;
          }
        `}</style>
      </div>
    </>
  );
}
