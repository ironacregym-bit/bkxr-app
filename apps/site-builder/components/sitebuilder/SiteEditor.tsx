import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Eye,
  FileText,
  Globe2,
  Image,
  LayoutDashboard,
  LoaderCircle,
  Megaphone,
  Palette,
  Search,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import CollapsiblePanel from "./CollapsiblePanel";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SiteDomainsCard from "./SiteDomainsCard";
import SiteEditorsCard from "./SiteEditorsCard";
import ImageUploadField from "./ImageUploadField";
import ImageGalleryBuilder from "./ImageGalleryBuilder";
import CustomTableBuilder from "./CustomTableBuilder";
import DocumentBuilder from "./DocumentBuilder";
import SitePaymentsCard from "./SitePaymentsCard";

type GetResp =
  | { ok: true; site: any; canEdit: boolean }
  | { ok: false; error: string; detail?: string };

type UpdateResp =
  | { ok: true; site: any }
  | { ok: false; error: string; detail?: string };

type EditorTab = "overview" | "content" | "design" | "media" | "marketing" | "payments" | "seo" | "access";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

const tabs: { id: EditorTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "content", label: "Content", icon: FileText },
  { id: "design", label: "Design", icon: Palette },
  { id: "media", label: "Media & resources", icon: Image },
  { id: "marketing", label: "Marketing", icon: Megaphone },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "seo", label: "SEO & sharing", icon: Search },
  { id: "access", label: "Domains & access", icon: Users },
];

function safeStr(value: any) {
  return String(value || "").trim();
}

function makeCloudinaryFaviconUrl(url: string) {
  const clean = safeStr(url);
  if (!clean) return "";
  if (clean.includes("res.cloudinary.com") && clean.includes("/image/upload/")) {
    return clean.replace("/image/upload/", "/image/upload/c_fill,w_64,h_64,r_max,f_png,q_auto/");
  }
  return clean;
}

function normaliseDocuments(site: any) {
  return Array.isArray(site?.documents) ? site.documents : [];
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
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];

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

function makeDraft(site: any) {
  return {
    published: Boolean(site.published),
    brand: {
      name: safeStr(site?.brand?.name),
      logoUrl: safeStr(site?.brand?.logoUrl),
      faviconUrl: safeStr(site?.brand?.faviconUrl),
    },
    theme: {
      template: site?.theme?.template === "editorial" ? "editorial" : "studio",
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
    promotion: site?.promotion || {
      enabled: false,
      title: "",
      description: "",
      buttonText: "",
      buttonUrl: "",
    },
    newsletter: site?.newsletter || {
      enabled: false,
      title: "Join Our Newsletter",
      description: "Get updates, news and special offers.",
      buttonText: "Subscribe",
      subscribeUrl: "",
    },
    mediaGallery: normaliseGallery(site),
    customTables: normaliseTables(site),
    documents: normaliseDocuments(site),
  };
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
      {help ? <span className="text-xs font-normal leading-relaxed text-muted-foreground">{help}</span> : null}
    </label>
  );
}

function PageSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <CollapsiblePanel title={title} description={description}>
      <div className="space-y-6">{children}</div>
    </CollapsiblePanel>
  );
}

export default function SiteEditor() {
  const router = useRouter();
  const siteId = useMemo(() => safeStr(router.query.siteId), [router.query.siteId]);
  const { data, mutate, isLoading } = useSWR<GetResp>(
    siteId ? `/api/sitebuilder/get?siteId=${encodeURIComponent(siteId)}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10_000 }
  );

  const site = data?.ok ? data.site : null;
  const canEdit = Boolean(data?.ok && data.canEdit);
  const [draft, setDraft] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("overview");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const draftSiteId = useRef("");

  useEffect(() => {
    if (!site || !siteId || draftSiteId.current === siteId) return;
    draftSiteId.current = siteId;
    setDraft(makeDraft(site));
  }, [siteId, site]);

  useEffect(() => {
    if (!router.isReady) return;
    const requestedView = Array.isArray(router.query.view) ? router.query.view[0] : router.query.view;
    if (tabs.some((tab) => tab.id === requestedView)) setActiveTab(requestedView as EditorTab);
  }, [router.isReady, router.query.view]);

  function navigateToTab(tab: EditorTab) {
    setActiveTab(tab);
    void router.replace(
      { pathname: router.pathname, query: { ...router.query, view: tab } },
      undefined,
      { shallow: true, scroll: false }
    );
  }

  function updateSection(section: string, key: string, value: any) {
    setDraft((current: any) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
  }

  function setLogoUrl(url: string) {
    setDraft((current: any) => {
      const nextLogo = safeStr(url);
      const currentFavicon = safeStr(current?.brand?.faviconUrl);
      const previousLogo = safeStr(current?.brand?.logoUrl);
      const previousAutoFavicon = makeCloudinaryFaviconUrl(previousLogo);
      const shouldAutoUpdateFavicon =
        !currentFavicon || currentFavicon === previousLogo || currentFavicon === previousAutoFavicon;

      return {
        ...current,
        brand: {
          ...current.brand,
          logoUrl: nextLogo,
          faviconUrl: shouldAutoUpdateFavicon ? makeCloudinaryFaviconUrl(nextLogo) : currentFavicon,
        },
      };
    });
  }

  async function save() {
    setMessage(null);
    if (!siteId) return;
    if (!canEdit) {
      setMessage("You don’t have permission to edit this site.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/sitebuilder/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ siteId, patch: draft }),
      });
      const result = (await response.json().catch(() => null)) as UpdateResp | null;
      if (!response.ok || !result?.ok) {
        setMessage(result && !result.ok ? result.detail || result.error : "Could not save changes.");
        return;
      }

      setMessage("All changes saved.");
      await mutate();
    } catch {
      setMessage("Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-muted-foreground">
        <div className="flex items-center gap-3">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Loading your site…
        </div>
      </main>
    );
  }

  if (!data?.ok) {
    return (
      <main className="min-h-screen bg-background px-4 py-12 text-foreground">
        <div className="mx-auto max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Could not load this site</CardTitle>
              <CardDescription>{data?.detail || data?.error || "Please try again."}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => router.push("/sitebuilder")}>
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!draft || draftSiteId.current !== siteId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-muted-foreground">
        <div className="flex items-center gap-3">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Preparing editor…
        </div>
      </main>
    );
  }

  const publicUrl = `/p/${encodeURIComponent(String(site.slug || ""))}`;
  const activeTabInfo = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const accent = /^#[\da-f]{6}$/i.test(draft.theme.accent) ? draft.theme.accent : "#1fe0a5";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back to dashboard"
              onClick={() => router.push("/sitebuilder")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{safeStr(site.brand?.name) || "Untitled site"}</div>
              <div className="truncate text-xs text-muted-foreground">/p/{site.slug}</div>
            </div>
            <Badge variant={draft.published ? "default" : "secondary"} className="hidden sm:inline-flex">
              {draft.published ? "Published" : "Draft"}
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {message ? <span role="status" className="hidden text-sm text-muted-foreground md:inline">{message}</span> : null}
            <Button variant="outline" size="sm" onClick={() => router.push(publicUrl)}>
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button size="sm" onClick={save} disabled={!canEdit || saving}>
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-10">
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="mb-3 hidden px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:block">
            Manage site
          </div>
          <nav aria-label="Site editor" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => navigateToTab(id)}
                aria-current={activeTab === id ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  activeTab === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-6 hidden rounded-xl border border-border bg-card p-4 lg:block">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Globe2 className="h-4 w-4 text-primary" />
              Public address
            </div>
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{publicUrl}</p>
            <Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => router.push(publicUrl)}>
              Open preview
            </Button>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          <div>
            <div className="text-sm text-muted-foreground">Site workspace</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{activeTabInfo.label}</h1>
          </div>

          {!canEdit ? (
            <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Read-only access: you can preview this site, but only an editor can change its settings.
            </div>
          ) : null}

          {activeTab === "overview" ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
              <PageSection
                title="Publishing"
                description="Your site remains private until it is published. Editors can still preview drafts."
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-primary"
                    checked={Boolean(draft.published)}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setDraft((current: any) => ({ ...current, published: event.target.checked }))
                    }
                  />
                  <span>
                    <span className="block font-medium">{draft.published ? "Site is published" : "Publish this site"}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {draft.published
                        ? "Anyone with your hosted or custom domain can view this site."
                        : "Save changes after enabling this option to make the site public."}
                    </span>
                  </span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={save} disabled={!canEdit || saving}>
                    {saving ? "Saving…" : draft.published ? "Save & publish" : "Save draft"}
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab("content")}>
                    Continue editing
                  </Button>
                </div>
              </PageSection>

              <PageSection title="Quick setup" description="Keep your public site complete and easy to find.">
                <div className="space-y-3">
                  {[
                    ["Site content", Boolean(draft.hero.headline || draft.sections.about), "content"],
                    ["Visual design", Boolean(draft.brand.name), "design"],
                    ["Search appearance", Boolean(draft.seo.title || draft.seo.description), "seo"],
                  ].map(([label, complete, tab]) => (
                    <button
                      key={String(label)}
                      type="button"
                      onClick={() => setActiveTab(tab as EditorTab)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted/50"
                    >
                      <span className="text-sm font-medium">{label}</span>
                      <Badge variant={complete ? "default" : "secondary"}>{complete ? "Ready" : "Add details"}</Badge>
                    </button>
                  ))}
                </div>
              </PageSection>
            </div>
          ) : null}

          {activeTab === "content" ? (
            <div className="space-y-6">
              <PageSection title="Hero" description="The first section visitors see. Keep the headline clear and the call to action specific.">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Headline">
                    <Input value={draft.hero.headline} disabled={!canEdit} onChange={(event) => updateSection("hero", "headline", event.target.value)} />
                  </Field>
                  <Field label="Button text">
                    <Input value={draft.hero.ctaText} disabled={!canEdit} placeholder="Get in touch" onChange={(event) => updateSection("hero", "ctaText", event.target.value)} />
                  </Field>
                </div>
                <Field label="Subheadline">
                  <Textarea rows={3} value={draft.hero.subheadline} disabled={!canEdit} onChange={(event) => updateSection("hero", "subheadline", event.target.value)} />
                </Field>
                <Field label="Button link" help="Use a section link such as #contact or a full https:// URL.">
                  <Input value={draft.hero.ctaHref} disabled={!canEdit} placeholder="#contact or https://example.com" onChange={(event) => updateSection("hero", "ctaHref", event.target.value)} />
                </Field>
                <fieldset disabled={!canEdit} className="min-w-0">
                  <ImageUploadField
                    label="Hero image"
                    value={draft.hero.imageUrl}
                    onChange={(url) => updateSection("hero", "imageUrl", url)}
                    folder="sitebuilder/heroes"
                    helpText="Upload a hero image or paste a publicly accessible image URL."
                  />
                </fieldset>
              </PageSection>

              <PageSection title="Page sections" description="Use blank lines to separate paragraphs. Headings use Markdown-style # and ## prefixes.">
                {[
                  ["about", "About", 6],
                  ["services", "Services", 6],
                  ["faq", "FAQ", 6],
                  ["contact", "Contact details", 5],
                ].map(([key, label, rows]) => (
                  <Field
                    key={String(key)}
                    label={String(label)}
                    help={key === "contact" ? "One item per line: Email, Phone, Instagram, or Address." : undefined}
                  >
                    <Textarea
                      rows={Number(rows)}
                      value={draft.sections[key as string]}
                      disabled={!canEdit}
                      placeholder={key === "contact" ? "Email: hello@example.com\nPhone: +44 20 1234 5678" : "Write your content here…"}
                      onChange={(event) => updateSection("sections", key as string, event.target.value)}
                    />
                  </Field>
                ))}
              </PageSection>
              <PageSection title="Information tables" description="Show opening hours, prices, events, or other structured information.">
                <fieldset disabled={!canEdit} className="min-w-0">
                  <CustomTableBuilder
                    value={draft.customTables}
                    onChange={(value) => setDraft((current: any) => ({ ...current, customTables: value }))}
                  />
                </fieldset>
              </PageSection>
            </div>
          ) : null}

          {activeTab === "design" ? (
            <div className="space-y-6">
              <PageSection title="Choose a template" description="Select a layout, then choose its light or dark appearance. Your current site content stays in place.">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { id: "studio", name: "Studio", description: "Bold, modern sections with a high-impact hero." },
                    { id: "editorial", name: "Editorial", description: "A refined, publication-inspired split layout." },
                  ].map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={draft.theme.template === template.id}
                      disabled={!canEdit}
                      onClick={() => updateSection("theme", "template", template.id)}
                      className={`group overflow-hidden rounded-xl border text-left transition ${
                        draft.theme.template === template.id
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className={`h-32 p-4 ${draft.theme.mode === "light" ? "bg-slate-100" : "bg-slate-950"}`}>
                        <div className={`h-3 w-1/3 rounded ${draft.theme.mode === "light" ? "bg-slate-300" : "bg-slate-700"}`} />
                        <div className={`mt-4 h-10 w-2/3 rounded ${template.id === "editorial" ? "ml-auto" : ""} ${draft.theme.mode === "light" ? "bg-white" : "bg-slate-800"}`} />
                        <div className="mt-3 flex gap-2">
                          <div className="h-5 w-16 rounded-full" style={{ backgroundColor: accent }} />
                          <div className={`h-5 w-12 rounded-full ${draft.theme.mode === "light" ? "bg-slate-300" : "bg-slate-700"}`} />
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="font-semibold">{template.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{template.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Appearance">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={draft.theme.mode}
                      disabled={!canEdit}
                      onChange={(event) => updateSection("theme", "mode", event.target.value)}
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </Field>
                  <Field label="Accent colour" help="Used for buttons and highlights across your public site.">
                    <div className="flex gap-2">
                      <input
                        aria-label="Choose accent colour"
                        type="color"
                        className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                        value={accent}
                        disabled={!canEdit}
                        onChange={(event) => updateSection("theme", "accent", event.target.value)}
                      />
                      <Input value={draft.theme.accent} disabled={!canEdit} onChange={(event) => updateSection("theme", "accent", event.target.value)} />
                    </div>
                  </Field>
                </div>
              </PageSection>
              <PageSection title="Brand identity" description="Set the name and images used in your header and browser tab.">
                <Field label="Site or business name">
                  <Input value={draft.brand.name} disabled={!canEdit} onChange={(event) => updateSection("brand", "name", event.target.value)} />
                </Field>
                <fieldset disabled={!canEdit} className="min-w-0">
                  <ImageUploadField
                    label="Logo"
                    value={draft.brand.logoUrl}
                    onChange={setLogoUrl}
                    folder="sitebuilder/logos"
                    helpText="Upload a logo or paste a public image URL. A favicon can be generated from this logo."
                  />
                </fieldset>
                <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted text-xs text-muted-foreground">
                    {draft.brand.faviconUrl ? <img src={draft.brand.faviconUrl} alt="Favicon preview" className="h-full w-full object-cover" /> : "No icon"}
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <Field label="Favicon URL">
                      <Input value={draft.brand.faviconUrl} disabled={!canEdit} placeholder="https://…" onChange={(event) => updateSection("brand", "faviconUrl", event.target.value)} />
                    </Field>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canEdit || !draft.brand.logoUrl}
                    onClick={() => updateSection("brand", "faviconUrl", makeCloudinaryFaviconUrl(draft.brand.logoUrl))}
                  >
                    Generate from logo
                  </Button>
                </div>
              </PageSection>
            </div>
          ) : null}

          {activeTab === "media" ? (
            <div className="space-y-6">
              <PageSection title="Image gallery" description="Upload and arrange images for a responsive gallery on your public site.">
                <fieldset disabled={!canEdit} className="min-w-0">
                  <ImageGalleryBuilder
                    value={draft.mediaGallery}
                    onChange={(value) => setDraft((current: any) => ({ ...current, mediaGallery: value }))}
                  />
                </fieldset>
              </PageSection>
              <PageSection title="Downloadable resources" description="Publish forms, menus, guides, and other files for visitors.">
                <fieldset disabled={!canEdit} className="min-w-0">
                  <DocumentBuilder
                    value={draft.documents}
                    onChange={(value) => setDraft((current: any) => ({ ...current, documents: value }))}
                  />
                </fieldset>
              </PageSection>
            </div>
          ) : null}

          <div className={activeTab === "payments" ? "space-y-3" : "hidden"} hidden={activeTab !== "payments"}>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Connect your own Stripe account and configure one-time products. Buyers are sent to Stripe-hosted Checkout; payments go directly to your connected account.
              </p>
              <SitePaymentsCard siteId={String(site.id)} active={activeTab === "payments"} />
          </div>

          {activeTab === "marketing" ? (
            <div className="space-y-6">
              <PageSection title="Promotion banner" description="Highlight an offer, event, or seasonal campaign.">
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={Boolean(draft.promotion.enabled)}
                    disabled={!canEdit}
                    onChange={(event) => updateSection("promotion", "enabled", event.target.checked)}
                  />
                  Show promotion on the public site
                </label>
                <Field label="Promotion title">
                  <Input value={draft.promotion.title} disabled={!canEdit} onChange={(event) => updateSection("promotion", "title", event.target.value)} />
                </Field>
                <Field label="Description">
                  <Textarea rows={3} value={draft.promotion.description} disabled={!canEdit} onChange={(event) => updateSection("promotion", "description", event.target.value)} />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Button text">
                    <Input value={draft.promotion.buttonText} disabled={!canEdit} onChange={(event) => updateSection("promotion", "buttonText", event.target.value)} />
                  </Field>
                  <Field label="Button URL">
                    <Input value={draft.promotion.buttonUrl} disabled={!canEdit} placeholder="https://…" onChange={(event) => updateSection("promotion", "buttonUrl", event.target.value)} />
                  </Field>
                </div>
              </PageSection>
              <PageSection title="Newsletter" description="Connect an existing newsletter or subscription form.">
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={Boolean(draft.newsletter.enabled)}
                    disabled={!canEdit}
                    onChange={(event) => updateSection("newsletter", "enabled", event.target.checked)}
                  />
                  Show newsletter section
                </label>
                <Field label="Section title">
                  <Input value={draft.newsletter.title} disabled={!canEdit} onChange={(event) => updateSection("newsletter", "title", event.target.value)} />
                </Field>
                <Field label="Description">
                  <Textarea rows={3} value={draft.newsletter.description} disabled={!canEdit} onChange={(event) => updateSection("newsletter", "description", event.target.value)} />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Button text">
                    <Input value={draft.newsletter.buttonText} disabled={!canEdit} onChange={(event) => updateSection("newsletter", "buttonText", event.target.value)} />
                  </Field>
                  <Field label="Subscription URL">
                    <Input value={draft.newsletter.subscribeUrl} disabled={!canEdit} placeholder="https://…" onChange={(event) => updateSection("newsletter", "subscribeUrl", event.target.value)} />
                  </Field>
                </div>
              </PageSection>
            </div>
          ) : null}

          {activeTab === "seo" ? (
            <PageSection title="Search & social sharing" description="Control how your site appears in search results and when shared.">
              <Field label="Page title" help="Aim for a concise title that describes the business or page.">
                <Input value={draft.seo.title} disabled={!canEdit} onChange={(event) => updateSection("seo", "title", event.target.value)} />
              </Field>
              <Field label="Search description">
                <Textarea rows={3} value={draft.seo.description} disabled={!canEdit} onChange={(event) => updateSection("seo", "description", event.target.value)} />
              </Field>
              <fieldset disabled={!canEdit} className="min-w-0">
                <ImageUploadField
                  label="Social share image"
                  value={draft.seo.image}
                  onChange={(url) => updateSection("seo", "image", url)}
                  folder="sitebuilder/seo"
                  helpText="Optional image shown when the site is shared on social platforms."
                />
              </fieldset>
            </PageSection>
          ) : null}

          {activeTab === "access" ? (
            <div className="space-y-6">
              <SiteDomainsCard
                siteId={String(site.id)}
                canEdit={canEdit}
                slug={String(site.slug || "")}
                onChanged={() => mutate()}
              />
              <SiteEditorsCard siteId={String(site.id)} onChanged={() => mutate()} />
            </div>
          ) : null}

          {message ? <p role="status" className="text-sm text-muted-foreground md:hidden">{message}</p> : null}
        </main>
      </div>
    </div>
  );
}
