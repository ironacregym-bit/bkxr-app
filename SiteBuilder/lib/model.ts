// File: SiteBuilder/lib/model.ts

export type SiteTheme = {
  accent?: string | null;
  mode?: "dark" | "light";
};

export type SiteHero = {
  headline: string;
  subheadline: string;
  imageUrl?: string | null;
  ctaText: string;
  ctaHref: string;
};

export type SiteSections = {
  about: string;
  services: string;
  faq: string;
  contact: string;
};

export type SiteSeo = {
  title: string;
  description: string;
  image?: string | null;
};

export type SiteGalleryImage = {
  id: string;
  imageUrl: string;
  title?: string;
  caption?: string;
  alt?: string;
};

export type SiteMediaGallery = {
  title: string;
  intro?: string;
  images: SiteGalleryImage[];
};

export type SiteCustomTable = {
  id: string;
  title: string;
  intro?: string;
  columns: string[];
  rows: string[][];
};

export type SiteDomain = {
  host: string;
  status: "pending" | "verified" | "active";
  verificationToken: string;
  addedAt: string;
  verifiedAt?: string;
};

export type SiteDoc = {
  id: string;
  slug: string;

  owner_email: string;
  editor_emails: string[];

  published: boolean;

  created_at: string;
  updated_at: string;

  theme: SiteTheme;
  seo: SiteSeo;
  brand: {
    name: string;
    logoUrl?: string | null;
    faviconUrl?: string | null;
  };

  hero: SiteHero;
  sections: SiteSections;

  mediaGallery: SiteMediaGallery;
  customTables:
  | SiteCustomTable[]
  | {
      order: string[];
      items: Record<
        string,
        {
          id: string;
          title: string;
          intro?: string;
          columnOrder: string[];
          columns: Record<string, string>;
          rowOrder: string[];
          rows: Record<
            string,
            {
              id: string;
              cells: Record<string, string>;
            }
          >;
        }
      >;
    };

  domains: SiteDomain[];
};

export function slugify(input: string) {
  const s = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
  return s;
}

export function validateSlug(slug: string) {
  if (!slug) return "Slug is required";
  if (slug.length < 3) return "Slug must be at least 3 characters";
  if (slug.length > 40) return "Slug must be 40 characters or less";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "Slug can only contain letters, numbers, and hyphens";
  return null;
}

export function nowIso() {
  return new Date().toISOString();
}

export function defaultSiteContent(args: { slug: string; ownerEmail: string; name?: string }) {
  const name = (args.name || "").trim() || "New Site";
  const title = `${name} | Official Site`;

  const created_at = nowIso();

  const doc: Omit<SiteDoc, "id"> = {
    slug: args.slug,

    owner_email: args.ownerEmail,
    editor_emails: [],

    published: false,

    created_at,
    updated_at: created_at,

    theme: {
      accent: "#1fe0a5",
      mode: "dark",
    },

    seo: {
      title,
      description: `Welcome to ${name}.`,
      image: null,
    },

    brand: {
      name,
      logoUrl: null,
      faviconUrl: null,
    },

    hero: {
      headline: "A simple page that converts",
      subheadline: "Clear message. One action. Clean design.",
      imageUrl: null,
      ctaText: "Get in touch",
      ctaHref: "#contact",
    },

    sections: {
      about:
        "Tell people who you are and why you exist. Keep it simple. Make it believable. Focus on the outcome you deliver.",
      services:
        "List your main offer in plain English. What do you do? Who is it for? What changes for the customer?",
      faq:
        "Answer the few questions that stop people acting. Keep answers short. Remove friction.",
      contact:
        "Email: hello@example.com\nPhone: \nInstagram: \nAddress: ",
    },

    mediaGallery: {
      title: "Gallery",
      intro: "",
      images: [],
    },

    customTables: {
      order: [],
      items: {},
    },

    domains: [],
  };

  return doc;
}

export function normalizeHost(host: string) {
  const h = String(host || "").trim().toLowerCase();
  return h.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export function makeVerificationToken() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}
