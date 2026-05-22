// File: SiteBuilder/lib/patch.ts
function safeStr(v: any, max = 4000) {
  const s = String(v || "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function safeUrl(v: any, max = 600) {
  const s = safeStr(v, max);
  if (!s) return "";
  if (s.startsWith("#")) return s;
  if (s.startsWith("/")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return s;
}

function safeHex(v: any) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return s;
  return "";
}

function safeThemeMode(v: any): "dark" | "light" {
  return String(v || "").trim().toLowerCase() === "light" ? "light" : "dark";
}

export function sanitizeSitePatch(patch: any) {
  const out: any = {};

  out.published = Boolean(patch?.published);

  out.brand = {
    name: safeStr(patch?.brand?.name, 80),
    logoUrl: safeUrl(patch?.brand?.logoUrl, 600) || null,
  };

  out.theme = {
    accent: safeHex(patch?.theme?.accent) || "#1fe0a5",
    mode: safeThemeMode(patch?.theme?.mode),
  };

  out.seo = {
    title: safeStr(patch?.seo?.title, 90),
    description: safeStr(patch?.seo?.description, 200),
    image: safeUrl(patch?.seo?.image, 600) || null,
  };

  out.hero = {
    headline: safeStr(patch?.hero?.headline, 120),
    subheadline: safeStr(patch?.hero?.subheadline, 400),
    imageUrl: safeUrl(patch?.hero?.imageUrl, 600) || null,
    ctaText: safeStr(patch?.hero?.ctaText, 50),
    ctaHref: safeUrl(patch?.hero?.ctaHref, 600) || "#contact",
  };

  out.sections = {
    about: safeStr(patch?.sections?.about, 6000),
    services: safeStr(patch?.sections?.services, 6000),
    faq: safeStr(patch?.sections?.faq, 6000),
    contact: safeStr(patch?.sections?.contact, 3000),
  };

  return out;
}
