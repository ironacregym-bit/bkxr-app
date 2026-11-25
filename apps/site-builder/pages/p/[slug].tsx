import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import type { CSSProperties, ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { firestore } from "@pt/firebase";
import { sanitizePublicPayments } from "@/lib/sitebuilder/payments";
import ProductCheckoutButton from "@/components/sitebuilder/ProductCheckoutButton";
import type { SiteDomain } from "@/lib/sitebuilder/model";
import { renderRichText } from "../../lib/sitebuilder/renderRichText";

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

type PublicPaymentProduct = {
  id: string;
  name: string;
  description: string;
  amountMinor: number;
  currency: string;
};

type PublicSite = {
  id: string;
  slug: string;
  published: boolean;
  owner_email?: string;
  editor_emails?: string[];
  domains?: SiteDomain[];
  tenantId?: string;
  payments?: {
    enabled: boolean;
    products: PublicPaymentProduct[];
  };
  updated_at?: string;
  mediaGallery?: MediaGallery;
  documents?: SiteDocument[];
  theme?: {
    template?: "studio" | "editorial" | string;
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
  customTables?: CustomTable[] | { order?: string[]; items?: Record<string, any> };
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

function normalizeHost(host: string) {
  return String(host || "").trim().toLowerCase().split(":")[0];
}

function safeText(value: any) {
  return String(value || "").trim();
}

function normaliseGallery(site: PublicSite) {
  const gallery = site?.mediaGallery || {};
  const images = (Array.isArray(gallery.images) ? gallery.images : [])
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
  const raw = site.customTables;
  if (Array.isArray(raw)) {
    return raw
      .map((table, tableIndex) => {
        const columns = Array.isArray(table?.columns)
          ? table.columns.map((column) => safeText(column)).filter(Boolean)
          : [];
        const rows = (Array.isArray(table?.rows) ? table.rows : [])
          .map((row) => columns.map((_, columnIndex) => safeText(row?.[columnIndex])))
          .filter((row) => row.some(Boolean));
        return {
          id: safeText(table?.id) || `table_${tableIndex}`,
          title: safeText(table?.title),
          intro: safeText(table?.intro),
          columns,
          rows,
        };
      })
      .filter((table) => table.title || table.rows.length > 0);
  }

  if (!raw || typeof raw !== "object") return [];
  const order = Array.isArray(raw.order) ? raw.order : [];
  const items = raw.items && typeof raw.items === "object" ? raw.items : {};

  return order
    .map((tableId, tableIndex) => {
      const table = items[tableId];
      if (!table || typeof table !== "object") return null;
      const columnOrder = Array.isArray(table.columnOrder) ? table.columnOrder : [];
      const columnsMap = table.columns && typeof table.columns === "object" ? table.columns : {};
      const columns = columnOrder.map((id: string) => safeText(columnsMap[id])).filter(Boolean);
      const rowOrder = Array.isArray(table.rowOrder) ? table.rowOrder : [];
      const rowsMap = table.rows && typeof table.rows === "object" ? table.rows : {};
      const rows = rowOrder
        .map((rowId: string) => {
          const row = rowsMap[rowId] || {};
          const cells = row.cells && typeof row.cells === "object" ? row.cells : {};
          return columnOrder.map((id: string) => safeText(cells[id]));
        })
        .filter((row: string[]) => row.some(Boolean));
      return {
        id: safeText(table.id) || safeText(tableId) || `table_${tableIndex}`,
        title: safeText(table.title),
        intro: safeText(table.intro),
        columns,
        rows,
      };
    })
    .filter((table: any) => table && (table.title || table.rows.length > 0));
}

function normaliseDocuments(site: PublicSite) {
  return (Array.isArray(site.documents) ? site.documents : []).filter(
    (document) => document?.title && document?.fileUrl
  );
}

function renderContactLine(line: string, accent: string) {
  const lower = line.toLowerCase();
  if (lower.startsWith("email:")) {
    const email = line.replace(/email:/i, "").trim();
    return <>Email: <a href={`mailto:${email}`} className="font-medium underline underline-offset-4" style={{ color: accent }}>{email}</a></>;
  }
  if (lower.startsWith("phone:")) {
    const phone = line.replace(/phone:/i, "").trim();
    return <>Phone: <a href={`tel:${phone}`} className="font-medium underline underline-offset-4" style={{ color: accent }}>{phone}</a></>;
  }
  if (lower.startsWith("instagram:")) {
    const handle = line.replace(/instagram:/i, "").trim();
    return <>Instagram: <a href={`https://instagram.com/${handle.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4" style={{ color: accent }}>{handle}</a></>;
  }
  if (lower.startsWith("address:")) {
    const address = line.replace(/address:/i, "").trim();
    return <>Address: <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4" style={{ color: accent }}>{address}</a></>;
  }
  return line;
}

function isAuthorized(site: { owner_email?: string; editor_emails?: string[] }, email: string) {
  const normalizedEmail = String(email || "").toLowerCase();
  if (!normalizedEmail) return false;
  if (String(site.owner_email || "").toLowerCase() === normalizedEmail) return true;
  const editors = Array.isArray(site.editor_emails) ? site.editor_emails : [];
  return editors.map((item) => String(item || "").toLowerCase()).includes(normalizedEmail);
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const slug = String(context.params?.slug || "").toLowerCase().trim();
  if (!slug) return { notFound: true };

  const session = await getServerSession(context.req, context.res, authOptions);
  const email = session?.user?.email ? String(session.user.email).toLowerCase() : "";
  const host = normalizeHost(String(context.req.headers.host || ""));
  const baseHost = normalizeHost(String(process.env.SITEBUILDER_BASE_HOST || ""));

  try {
    const slugSnapshot = await firestore.collection("sitebuilder_slugs").doc(slug).get();
    if (!slugSnapshot.exists) return { notFound: true };

    const slugData: any = slugSnapshot.data() || {};
    const siteId = String(slugData.siteId || "").trim();
    if (!siteId) return { notFound: true };

    const siteSnapshot = await firestore.collection("sitebuilder_sites").doc(siteId).get();
    if (!siteSnapshot.exists) return { notFound: true };

    const site = siteSnapshot.data() as PublicSite;
    const canEdit = isAuthorized(site, email);
    if (!site.published && !canEdit) return { notFound: true };

    const {
      owner_email: _ownerEmail,
      editor_emails: _editorEmails,
      domains: _domains,
      tenantId: _tenantId,
      ...publicSite
    } = site;
    return {
      props: {
        site: {
          ...(publicSite as any),
          id: siteId,
          slug,
          payments: sanitizePublicPayments(site.payments),
        },
        canEdit,
        isCustomDomain: Boolean(host && baseHost && host !== baseHost),
      },
    };
  } catch (error) {
    console.error("[p/[slug]] SSR failed:", error);
    return { notFound: true };
  }
};

export default function PublicSitePage(props: {
  site: PublicSite;
  canEdit: boolean;
  isCustomDomain: boolean;
}) {
  const { site, canEdit, isCustomDomain } = props;
  const accent = safeText(site.theme?.accent) || "#1fe0a5";
  const isLight = String(site.theme?.mode || "dark").toLowerCase() === "light";
  const isEditorial = site.theme?.template === "editorial";
  const title = safeText(site.seo?.title) || safeText(site.brand?.name) || "Site";
  const description = safeText(site.seo?.description);
  const ogImage = site.seo?.image || site.hero?.imageUrl || null;
  const brandName = safeText(site.brand?.name) || "Site";
  const logoUrl = site.brand?.logoUrl || null;
  const faviconUrl = safeText(site.brand?.faviconUrl) || safeText(site.brand?.logoUrl);
  const faviconHref = faviconUrl
    ? `${faviconUrl}${faviconUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(site.updated_at || "1")}`
    : "";
  const heroHeadline = safeText(site.hero?.headline) || brandName;
  const heroSubheadline = safeText(site.hero?.subheadline);
  const heroImage = site.hero?.imageUrl || null;
  const ctaText = safeText(site.hero?.ctaText) || "Get started";
  const ctaHref = safeText(site.hero?.ctaHref) || "#contact";
  const promotion = site.promotion;
  const newsletter = site.newsletter;
  const contactLines = safeText(site.sections?.contact).split("\n").map((line) => line.trim()).filter(Boolean);
  const addressLine = contactLines.find((line) => line.toLowerCase().startsWith("address:"));
  const address = addressLine ? addressLine.replace(/address:/i, "").trim() : "";
  const gallery = normaliseGallery(site);
  const tables = normaliseTables(site);
  const documents = normaliseDocuments(site);
  const products = site.payments?.enabled ? site.payments.products : [];
  const isDraft = !site.published;
  const pageBackground = isLight ? "#ffffff" : "#070b10";
  const surfaceBackground = isLight ? "#f7f8fa" : "#0d131b";
  const foreground = isLight ? "#171b22" : "#f4f6f8";
  const mutedForeground = isLight ? "rgba(23,27,34,0.68)" : "rgba(244,246,248,0.68)";
  const borderColor = isLight ? "rgba(23,27,34,0.1)" : "rgba(244,246,248,0.12)";
  const pageStyle: CSSProperties = { backgroundColor: pageBackground, color: foreground };
  const surfaceStyle: CSSProperties = { backgroundColor: surfaceBackground, borderColor };
  const sectionClass = isEditorial
    ? "border-b py-10 last:border-b-0 md:py-14"
    : "rounded-2xl border px-5 py-7 shadow-sm sm:px-8 md:py-9";
  const headingClass = isEditorial
    ? "mb-5 font-serif text-3xl font-semibold tracking-tight sm:text-4xl"
    : "mb-5 text-2xl font-semibold tracking-tight sm:text-3xl";
  const CTA = ({ href, children, secondary = false }: { href: string; children: ReactNode; secondary?: boolean }) => (
    <a
      href={href}
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-85 ${
        secondary ? "border border-current bg-transparent" : ""
      }`}
      style={secondary ? { borderColor, color: foreground } : { backgroundColor: accent, color: isLight ? "#101820" : "#071018" }}
    >
      {children}
    </a>
  );
  const Section = ({ id, title: sectionTitle, children }: { id?: string; title: string; children: ReactNode }) => (
    <section id={id} className={sectionClass} style={isEditorial ? { borderColor } : surfaceStyle}>
      <h2 className={headingClass}>{sectionTitle}</h2>
      {children}
    </section>
  );

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
        {isDraft ? <meta name="robots" content="noindex,nofollow" /> : null}
        {faviconHref ? <link rel="icon" href={faviconHref} /> : null}
      </Head>

      <div className="min-h-screen" style={pageStyle}>
        {canEdit && isDraft ? (
          <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm backdrop-blur sm:px-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
              Draft page: only you and your editors can see this.
            </div>
            <Link className="font-semibold underline underline-offset-4" href={`/sitebuilder/${encodeURIComponent(String(site.id))}`}>
              Open editor
            </Link>
          </div>
        ) : null}

        <header className="border-b" style={{ borderColor, backgroundColor: isLight ? "rgba(255,255,255,.92)" : "rgba(7,11,16,.92)" }}>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <a href="#top" className="flex min-w-0 items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt={`${brandName} logo`} className="h-10 w-auto max-w-40 object-contain" />
              ) : (
                <span className="h-9 w-9 rounded-xl" style={{ background: `linear-gradient(135deg, ${accent}, #6ea8ff)` }} aria-hidden="true" />
              )}
              <span className="truncate font-semibold">{brandName}</span>
            </a>
            <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" style={{ color: mutedForeground }}>
              <a className="hover:underline" href="#about">About</a>
              <a className="hover:underline" href="#services">Services</a>
              {gallery.images.length ? <a className="hover:underline" href="#gallery">Gallery</a> : null}
              {products.length ? <a className="hover:underline" href="#payments">Buy</a> : null}
              <a className="hover:underline" href="#contact">Contact</a>
              {canEdit ? (
                <Link
                  className="rounded-full border px-4 py-2 font-semibold"
                  style={{ borderColor, color: foreground }}
                  href={`/sitebuilder/${encodeURIComponent(String(site.id))}`}
                >
                  Edit site
                </Link>
              ) : null}
            </nav>
          </div>
        </header>

        <main id="top" className="mx-auto max-w-6xl space-y-6 px-5 py-7 sm:px-8 sm:py-10">
          <section
            className={`relative isolate overflow-hidden rounded-3xl ${isEditorial ? "grid gap-8 border-b py-8 md:grid-cols-2 md:items-center md:py-14" : "flex min-h-[440px] items-center border"}`}
            style={!heroImage || isEditorial ? { ...surfaceStyle, borderColor } : { borderColor }}
          >
            {heroImage && !isEditorial ? (
              <>
                <img src={heroImage} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
                <div
                  className={`absolute inset-0 -z-10 ${isLight ? "bg-gradient-to-t from-white/95 via-white/65 to-white/10" : "bg-gradient-to-t from-black/90 via-black/55 to-black/20"}`}
                  aria-hidden="true"
                />
              </>
            ) : null}
            <div className={`relative z-10 max-w-3xl ${isEditorial ? "py-6 md:py-0" : "px-6 py-16 sm:px-10 md:px-14"}`}>
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>
                {brandName}
              </div>
              <h1 className={`${isEditorial ? "font-serif" : ""} text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl`}>
                {heroHeadline}
              </h1>
              {heroSubheadline ? (
                <p className="mt-5 max-w-2xl text-base leading-7 sm:text-lg" style={{ color: mutedForeground }}>
                  {heroSubheadline}
                </p>
              ) : null}
              <div className="mt-8 flex flex-wrap gap-3">
                <CTA href={ctaHref}>{ctaText}</CTA>
                <CTA href="#about" secondary>Learn more</CTA>
              </div>
            </div>
            {heroImage && isEditorial ? (
              <div className="overflow-hidden rounded-2xl border" style={{ borderColor }}>
                <img src={heroImage} alt="" className="max-h-[520px] min-h-64 w-full object-cover" />
              </div>
            ) : null}
          </section>

          {promotion?.enabled ? (
            <Section title={safeText(promotion.title) || "Featured"}>
              <p className="mb-5 leading-7" style={{ color: mutedForeground }}>{promotion.description}</p>
              {promotion.buttonUrl ? <CTA href={promotion.buttonUrl}>{promotion.buttonText || "Learn more"}</CTA> : null}
            </Section>
          ) : null}

          <Section id="about" title="About">
            {site.sections?.about ? <div>{renderRichText(site.sections.about)}</div> : <p style={{ color: mutedForeground }}>No content yet.</p>}
          </Section>
          <Section id="services" title="Services">
            {site.sections?.services ? <div>{renderRichText(site.sections.services)}</div> : <p style={{ color: mutedForeground }}>No content yet.</p>}
          </Section>

          {tables.length ? (
            <Section id="tables" title="Information">
              <div className="space-y-6">
                {tables.map((table: any) => (
                  <div key={table.id} className="rounded-xl border p-4 sm:p-5" style={{ borderColor }}>
                    {table.title ? <h3 className="mb-2 text-lg font-semibold">{table.title}</h3> : null}
                    {table.intro ? <p className="mb-4 text-sm leading-6" style={{ color: mutedForeground }}>{table.intro}</p> : null}
                    {table.columns.length && table.rows.length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[480px] border-collapse text-sm">
                          <thead>
                            <tr className="border-b" style={{ borderColor }}>
                              {table.columns.map((column: string, index: number) => (
                                <th key={`${table.id}_head_${index}`} className="px-3 py-3 text-left font-semibold">{column}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {table.rows.map((row: string[], rowIndex: number) => (
                              <tr key={`${table.id}_row_${rowIndex}`} className="border-b last:border-0" style={{ borderColor }}>
                                {table.columns.map((_: string, columnIndex: number) => (
                                  <td key={`${table.id}_cell_${rowIndex}_${columnIndex}`} className="px-3 py-3" style={{ color: mutedForeground }}>{row[columnIndex] || "—"}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p style={{ color: mutedForeground }}>No table entries yet.</p>}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {gallery.images.length ? (
            <Section id="gallery" title={gallery.title}>
              {gallery.intro ? <p className="mb-6 leading-7" style={{ color: mutedForeground }}>{gallery.intro}</p> : null}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {gallery.images.map((image: any) => (
                  <figure key={image.id} className="overflow-hidden rounded-xl border" style={{ borderColor, backgroundColor: pageBackground }}>
                    <img src={image.imageUrl} alt={image.alt || image.title || ""} className="aspect-[4/3] w-full object-cover" />
                    {image.title || image.caption ? (
                      <figcaption className="p-4">
                        {image.title ? <div className="font-semibold">{image.title}</div> : null}
                        {image.caption ? <div className="mt-1 text-sm leading-relaxed" style={{ color: mutedForeground }}>{image.caption}</div> : null}
                      </figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            </Section>
          ) : null}

          {documents.length ? (
            <Section id="documents" title="Documents">
              <div className="grid gap-3 sm:grid-cols-2">
                {documents.map((document: any, index: number) => (
                  <a
                    key={document.id || index}
                    href={document.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`rounded-xl border p-4 transition-colors ${isLight ? "hover:bg-black/5" : "hover:bg-white/5"}`}
                    style={{ borderColor }}
                  >
                    <div className="font-semibold">{document.title}</div>
                    {document.description ? <div className="mt-1 text-sm leading-relaxed" style={{ color: mutedForeground }}>{document.description}</div> : null}
                    <div className="mt-4 text-sm font-semibold" style={{ color: accent }}>Download document <span aria-hidden="true">→</span></div>
                  </a>
                ))}
              </div>
            </Section>
          ) : null}

          {products.length ? (
            <section id="payments" className={sectionClass} style={isEditorial ? { borderColor } : surfaceStyle}>
              <h2 className={headingClass}>Products & services</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <article key={product.id} className="flex flex-col rounded-xl border p-5" style={{ borderColor, backgroundColor: pageBackground }}>
                    <h3 className="text-lg font-semibold">{product.name}</h3>
                    {product.description ? <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: mutedForeground }}>{product.description}</p> : <div className="flex-1" />}
                    <div className="my-5 text-2xl font-semibold">
                      {new Intl.NumberFormat("en-GB", {
                        style: "currency",
                        currency: product.currency.toUpperCase(),
                      }).format(product.amountMinor / 100)}
                    </div>
                    <ProductCheckoutButton slug={site.slug} productId={product.id} />
                  </article>
                ))}
              </div>
              <p className="mt-4 text-xs" style={{ color: mutedForeground }}>Secure payments are processed by Stripe.</p>
            </section>
          ) : null}

          <Section id="faq" title="FAQ">
            {site.sections?.faq ? <div>{renderRichText(site.sections.faq)}</div> : <p style={{ color: mutedForeground }}>No content yet.</p>}
          </Section>

          <Section id="contact" title="Contact">
            {contactLines.length ? (
              <>
                <div className="space-y-2 leading-7" style={{ color: mutedForeground }}>
                  {contactLines.map((line, index) => <div key={index}>{renderContactLine(line, accent)}</div>)}
                </div>
                {address ? (
                  <div className="mt-6 overflow-hidden rounded-xl border" style={{ borderColor }}>
                    <iframe
                      title="Location map"
                      src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                      loading="lazy"
                      className="h-72 w-full"
                    />
                  </div>
                ) : null}
              </>
            ) : <p style={{ color: mutedForeground }}>No contact details yet.</p>}
          </Section>

          {newsletter?.enabled ? (
            <Section title={safeText(newsletter.title) || "Join our newsletter"}>
              <p className="mb-5 leading-7" style={{ color: mutedForeground }}>{newsletter.description}</p>
              {newsletter.subscribeUrl ? (
                <CTA href={newsletter.subscribeUrl}>{newsletter.buttonText || "Subscribe"}</CTA>
              ) : null}
            </Section>
          ) : null}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t py-6 text-sm" style={{ borderColor, color: mutedForeground }}>
            <span>{isCustomDomain ? "" : "Powered by SiteBuilder"}</span>
            <span>© {new Date().getFullYear()} {brandName}</span>
          </footer>
        </main>
      </div>
    </>
  );
}
