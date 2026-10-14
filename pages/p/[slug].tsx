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
  documents?: SiteDocument[];
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
  promotion?: {
    enabled?: boolean;
    title?: string;
    description?: string;
    buttonText?: string;
    buttonUrl?: string;
  };
  
  newsletter?: {
    enabled?: boolean;
    title?: string;
    description?: string;
    buttonText?: string;
    subscribeUrl?: string;
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
type SiteDocument = {
  id?: string;
  title?: string;
  description?: string;
  fileUrl?: string;
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
function normaliseDocuments(site: PublicSite) {
  const docs = Array.isArray(
    (site as any)?.documents
  )
    ? (site as any).documents
    : [];

  return docs.filter(
    (x: any) =>
      x?.title &&
      x?.fileUrl
  );
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
  const promotion = site?.promotion;
  const newsletter = site?.newsletter;
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
  const documents = normaliseDocuments(site);
  const hasDocuments = documents.length > 0;
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

      <div className="sb-wrap"
        style={ { "--sb-bg": bg,
                 "--sb-text": text,
                 "--sb-muted": muted,
                 "--sb-border": border,
                 "--sb-card-bg": cardBg,
                 "--sb-top-bg": topBg,
                 "--sb-accent": accent,
                 "--sb-mark-bg": markBg,
                 "--sb-hero-overlay": heroOverlay, 
                } as React.CSSProperties }>
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
          {promotion?.enabled ? (
            <section className="sb-section">
              <h2 className="sb-h2">
                {promotion.title}
              </h2>
          
              <p className="sb-sectionIntro">
                {promotion.description}
              </p>
          
              {promotion.buttonUrl ? (
                <a
                  href={promotion.buttonUrl}
                  className="sb-cta"
                >
                  {promotion.buttonText || "Learn More"}
                </a>
              ) : null}
            </section>
          ) : null}
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
        {hasDocuments ? (
          <section
            id="documents"
            className="sb-section"
          >
            <h2 className="sb-h2">
              Documents
            </h2>
          <div className="sb-docGrid">
            {documents.map((doc: any) => (
              <a
                key={doc.id}
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer">
               
                <div className="sb-docTitle">
                  {doc.title}
                </div>
                <div className="sb-docDescription">
                  {doc.description}
                </div>
                
                <div className="sb-docLink">
                  Download Document →
                </div>
              </a>
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
          {newsletter?.enabled ? (
            <section className="sb-section">
              <h2 className="sb-h2">
                {newsletter.title}
              </h2>
          
              <p className="sb-sectionIntro">
                {newsletter.description}
              </p>
          
              {newsletter.subscribeUrl ? (
                <a
                  href={newsletter.subscribeUrl}
                  className="sb-cta"
                  target="_blank"
                  rel="noreferrer"
                >
                  {newsletter.buttonText || "Subscribe"}
                </a>
              ) : null}
            </section>
          ) : null}
          <footer className="sb-foot">
            <div className="sb-footInner">
              <div className="sb-footText">{isCustomDomain ? "" : "Powered by SiteBuilder"}</div>
              <div className="sb-footText">© {new Date().getFullYear()}</div>
            </div>
          </footer>
        </main>


      </div>
    </>
  );
}
