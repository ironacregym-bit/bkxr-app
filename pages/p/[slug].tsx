// File: pages/p/[slug].tsx
import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]";
import firestore from "../../lib/firestoreClient";

type PublicSite = {
  id: string;
  slug: string;
  published: boolean;
  owner_email: string;
  editor_emails: string[];
  updated_at?: string;

  theme?: { accent?: string | null };

  seo?: {
    title?: string;
    description?: string;
    image?: string | null;
  };

  brand?: {
    name?: string;
    logoUrl?: string | null;
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
    const slugRef = firestore.collection("sitebuilder_slugs").doc(slug);
    const slugSnap = await slugRef.get();
    if (!slugSnap.exists) return { notFound: true };

    const slugData: any = slugSnap.data() || {};
    const siteId = String(slugData.siteId || "").trim();
    if (!siteId) return { notFound: true };

    const siteRef = firestore.collection("sitebuilder_sites").doc(siteId);
    const siteSnap = await siteRef.get();
    if (!siteSnap.exists) return { notFound: true };

    const site = siteSnap.data() as PublicSite;

    const canEdit = isAuthorized(site, email);
    const isPublished = Boolean(site.published);

    if (!isPublished && !canEdit) return { notFound: true };

    return {
      props: {
        site: {
          ...site,
          id: siteId,
          slug,
        },
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
  const { site, canEdit } = props;

  const accent = site?.theme?.accent || "#1fe0a5";
  const title = safeText(site?.seo?.title) || safeText(site?.brand?.name) || "Site";
  const description = safeText(site?.seo?.description) || "";
  const ogImage = site?.seo?.image || site?.hero?.imageUrl || null;

  const brandName = safeText(site?.brand?.name) || "Site";
  const logoUrl = site?.brand?.logoUrl || null;

  const heroHeadline = safeText(site?.hero?.headline) || brandName;
  const heroSub = safeText(site?.hero?.subheadline) || "";
  const heroImage = site?.hero?.imageUrl || null;

  const ctaText = safeText(site?.hero?.ctaText) || "Get started";
  const ctaHref = safeText(site?.hero?.ctaHref) || "#contact";

  const aboutParas = splitParagraphs(site?.sections?.about);
  const servicesParas = splitParagraphs(site?.sections?.services);
  const faqParas = splitParagraphs(site?.sections?.faq);
  const contactLines = safeText(site?.sections?.contact)
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  return (
    <>
      <Head>
        <title>{title}</title>
        {description ? <meta name="description" content={description} /> : null}
        <meta property="og:title" content={title} />
        {description ? <meta property="og:description" content={description} /> : null}
        <meta property="og:type" content="website" />
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="sb-wrap">
        <header className="sb-top">
          <div className="sb-brand">
            {logoUrl ? (
              <img className="sb-logo" src={logoUrl} alt="" />
            ) : (
              <div className="sb-mark" aria-hidden="true" />
            )}
            <div className="sb-brandText">{brandName}</div>
          </div>

          <div className="sb-actions">
            {canEdit ? (
              <Link className="sb-edit" href={`/sitebuilder/${encodeURIComponent(site.id)}`}>
                Edit
              </Link>
            ) : null}
          </div>
        </header>

        <main className="sb-main">
          <section className="sb-hero">
            {heroImage ? (
              <div className="sb-heroMedia" aria-hidden="true">
                <img className="sb-heroImg" src={heroImage} alt="" />
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
            {aboutParas.length ? (
              <div className="sb-body">
                {aboutParas.map((p, i) => (
                  <p key={i} className="sb-p">
                    {p}
                  </p>
                ))}
              </div>
            ) : (
              <div className="sb-muted">No content yet.</div>
            )}
          </section>

          <section id="services" className="sb-section">
            <h2 className="sb-h2">Services</h2>
            {servicesParas.length ? (
              <div className="sb-body">
                {servicesParas.map((p, i) => (
                  <p key={i} className="sb-p">
                    {p}
                  </p>
                ))}
              </div>
            ) : (
              <div className="sb-muted">No content yet.</div>
            )}
          </section>

          <section id="faq" className="sb-section">
            <h2 className="sb-h2">FAQ</h2>
            {faqParas.length ? (
              <div className="sb-body">
                {faqParas.map((p, i) => (
                  <p key={i} className="sb-p">
                    {p}
                  </p>
                ))}
              </div>
            ) : (
              <div className="sb-muted">No content yet.</div>
            )}
          </section>

          <section id="contact" className="sb-section">
            <h2 className="sb-h2">Contact</h2>
            {contactLines.length ? (
              <div className="sb-body">
                {contactLines.map((line, i) => (
                  <div key={i} className="sb-line">
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <div className="sb-muted">No contact details yet.</div>
            )}
          </section>

          <footer className="sb-foot">
            <div className="sb-footInner">
              <div className="sb-footText">Powered by SiteBuilder</div>
              <div className="sb-footText">© {new Date().getFullYear()}</div>
            </div>
          </footer>
        </main>

        <style jsx>{`
          .sb-wrap {
            min-height: 100vh;
            background: #06090d;
            color: #fff;
          }

          .sb-top {
            position: sticky;
            top: 0;
            z-index: 20;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 14px 18px;
            background: rgba(6, 9, 13, 0.82);
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
            background: linear-gradient(135deg, ${accent}, rgba(110, 168, 255, 0.75));
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

          .sb-actions {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .sb-edit {
            color: rgba(255, 255, 255, 0.85);
            text-decoration: none;
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: rgba(0, 0, 0, 0.18);
            font-weight: 600;
            min-height: 44px;
            display: inline-flex;
            align-items: center;
          }

          .sb-edit:hover {
            border-color: rgba(255, 255, 255, 0.2);
            color: rgba(255, 255, 255, 0.95);
          }

          .sb-main {
            max-width: 980px;
            margin: 0 auto;
            padding: 18px;
          }

          .sb-hero {
            border-radius: 18px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: radial-gradient(900px 420px at 20% 15%, rgba(31, 224, 165, 0.14), transparent 55%),
              radial-gradient(900px 420px at 75% 0%, rgba(110, 168, 255, 0.14), transparent 60%),
              #0b0f14;
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
            background: linear-gradient(180deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.75) 100%);
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
            text-shadow: 0 14px 40px rgba(0, 0, 0, 0.55);
          }

          .sb-lead {
            margin: 12px 0 0 0;
            color: rgba(255, 255, 255, 0.8);
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
            background: rgba(0, 0, 0, 0.18);
            border: 1px solid rgba(255, 255, 255, 0.14);
            color: rgba(255, 255, 255, 0.88);
            text-decoration: none;
            font-weight: 600;
            border-radius: 14px;
            padding: 12px 16px;
            min-height: 46px;
            display: inline-flex;
            align-items: center;
          }

          .sb-ctaGhost:hover {
            border-color: rgba(255, 255, 255, 0.22);
            color: rgba(255, 255, 255, 0.98);
          }

          .sb-section {
            margin-top: 16px;
            border-radius: 18px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: #0b0f14;
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
            color: rgba(255, 255, 255, 0.78);
            line-height: 1.55;
            font-weight: 450;
          }

          .sb-line {
            color: rgba(255, 255, 255, 0.78);
            line-height: 1.55;
            font-weight: 450;
            margin-top: 6px;
          }

          .sb-muted {
            margin-top: 10px;
            color: rgba(255, 255, 255, 0.55);
            font-weight: 450;
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
            color: rgba(255, 255, 255, 0.5);
            font-size: 12px;
          }

          @media (max-width: 720px) {
            .sb-h1 {
              font-size: 38px;
            }
          }
        `}</style>
      </div>
    </>
  );
}
