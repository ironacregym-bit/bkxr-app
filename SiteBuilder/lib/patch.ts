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
  return "";
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

function safeId(v: any) {
  const s = String(v || "").trim();
  if (/^[a-zA-Z0-9_-]{4,80}$/.test(s)) return s;
  return `item_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeGallery(input: any) {
  const imagesRaw = Array.isArray(input?.images) ? input.images : [];

  const images = imagesRaw
    .slice(0, 60)
    .map((item: any) => ({
      id: safeId(item?.id),
      imageUrl: safeUrl(item?.imageUrl, 600),
      title: safeStr(item?.title, 80),
      caption: safeStr(item?.caption, 240),
      alt: safeStr(item?.alt, 140),
    }))
    .filter((item: any) => item.imageUrl);

  return {
    title: safeStr(input?.title, 80) || "Gallery",
    intro: safeStr(input?.intro, 500),
    images,
  };
}

function sanitizeCustomTables(input: any) {
  const tablesRaw = Array.isArray(input) ? input : [];

  return tablesRaw
    .slice(0, 12)
    .map((table: any) => {
      const columnsRaw = Array.isArray(table?.columns) ? table.columns : [];
      const columns = columnsRaw
        .slice(0, 8)
        .map((column: any) => safeStr(column, 40))
        .filter(Boolean);

      const safeColumns = columns.length > 0 ? columns : ["Column 1"];

      const rowsRaw = Array.isArray(table?.rows) ? table.rows : [];
      const rows = rowsRaw.slice(0, 80).map((row: any) => {
        const rowArray = Array.isArray(row) ? row : [];
        return safeColumns.map((_: string, index: number) => safeStr(rowArray[index], 120));
      });

      return {
        id: safeId(table?.id),
        title: safeStr(table?.title, 90),
        intro: safeStr(table?.intro, 500),
        columns: safeColumns,
        rows,
      };
    })
    .filter((table: any) => table.title || table.rows.length > 0);
}

export function sanitizeSitePatch(patch: any) {
  const out: any = {};

  out.published = Boolean(patch?.published);

  out.brand = {
    name: safeStr(patch?.brand?.name, 80),
    logoUrl: safeUrl(patch?.brand?.logoUrl, 600) || null,
    faviconUrl: safeUrl(patch?.brand?.faviconUrl, 600) || null,
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

  out.mediaGallery = sanitizeGallery(patch?.mediaGallery);
  out.customTables = sanitizeCustomTables(patch?.customTables);

  return out;
}
