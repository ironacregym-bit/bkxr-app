import { useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { ArrowUpRight, Globe2, LoaderCircle, Pencil, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CollapsiblePanel from "./CollapsiblePanel";

type SiteSummary = {
  id: string;
  slug: string;
  name: string;
  published: boolean;
  updated_at: string;
};

type MineResp =
  | { ok: true; sites: SiteSummary[] }
  | { ok: false; error: string; detail?: string };

type CreateResp =
  | { ok: true; siteId: string; slug: string }
  | { ok: false; error: string; detail?: string };

const fetcher = (url: string) => fetch(url).then((response) => response.json());

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
  const { data, mutate, isLoading } = useSWR<MineResp>(
    "/api/sitebuilder/mine",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 10_000 }
  );
  const sites = useMemo(() => (data?.ok ? data.sites : []), [data]);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publishedCount = sites.filter((site) => site.published).length;
  const draftCount = sites.length - publishedCount;
  const visibleSites = sites.filter((site) => {
    const matchesQuery = `${site.name} ${site.slug}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === "all" || (filter === "published" ? site.published : !site.published);
    return matchesQuery && matchesFilter;
  });

  async function create() {
    setError(null);
    const cleanSlug = slugify(slug || name);

    if (!cleanSlug || cleanSlug.length < 3) {
      setError("Enter a name or slug (min 3 characters).");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/sitebuilder/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ name: name.trim(), slug: cleanSlug }),
      });
      const result = (await response.json().catch(() => null)) as CreateResp | null;

      if (!response.ok || !result?.ok) {
        const code = result && !result.ok ? result.error : "CREATE_FAILED";
        setError(
          code === "SLUG_TAKEN"
            ? "That slug is already taken."
            : result && !result.ok
              ? result.detail || "Could not create site."
              : "Could not create site."
        );
        return;
      }

      await mutate();
      await router.push(`/sitebuilder/${encodeURIComponent(result.siteId)}`);
    } catch {
      setError("Could not create site.");
    } finally {
      setCreating(false);
    }
  }

  const previewSlug = slugify(slug || name) || "your-slug";

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
              <Globe2 className="h-3.5 w-3.5" />
              Content management
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Your websites
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Create, publish, and manage your content, design, domains, and collaborators.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[280px]">
            {[
              ["Sites", sites.length],
              ["Published", publishedCount],
              ["Drafts", draftCount],
            ].map(([label, count]) => (
              <div key={String(label)} className="rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="text-lg font-semibold">{count}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
          <CollapsiblePanel
            className="h-fit"
            title={
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Start a new site
              </span>
            }
            description="Choose a name and a hosted URL. You can connect a custom domain later."
          >
            <div className="space-y-4">
              <label className="block space-y-2 text-sm font-medium">
                Site name
                <Input
                  placeholder="Acme Plumbing"
                  value={name}
                  onChange={(event) => {
                    const value = event.target.value;
                    setName(value);
                    if (!slug) setSlug(slugify(value));
                  }}
                />
              </label>

              <label className="block space-y-2 text-sm font-medium">
                URL slug
                <Input
                  placeholder="acme-plumbing"
                  value={slug}
                  onChange={(event) => setSlug(slugify(event.target.value))}
                />
              </label>

              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <Button
                variant="default"
                className="w-full"
                onClick={create}
                disabled={creating}
              >
                {creating ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {creating ? "Creating..." : "Create site"}
              </Button>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Your hosted URL will be{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                  /p/{previewSlug}
                </code>
                . You can add a custom domain in settings.
              </p>
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel
            title="Your sites"
            description="Edit content, manage publishing, and preview each site."
          >
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9 sm:w-48"
                      aria-label="Search sites"
                      placeholder="Search sites"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    aria-label="Filter sites"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value as "all" | "published" | "draft")}
                  >
                    <option value="all">All sites</option>
                    <option value="published">Published</option>
                    <option value="draft">Drafts</option>
                  </select>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading sites...
                </div>
              ) : null}

              {!isLoading && data && !data.ok ? (
                <p role="alert" className="py-4 text-sm text-destructive">
                  {data.detail || data.error || "Could not load sites."}
                </p>
              ) : null}

              {!isLoading && data?.ok && sites.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
                  <Globe2 className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 font-medium">No sites yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Create your first site to get started.</p>
                </div>
              ) : null}

              {!isLoading && data?.ok && sites.length > 0 && visibleSites.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No sites match those filters.
                </p>
              ) : null}

              <div className="space-y-3">
                {visibleSites.map((site) => (
                  <div
                    key={site.id}
                    className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="truncate font-medium">
                        {site.name || "Untitled"}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <code className="font-mono">/p/{site.slug}</code>
                        <span aria-hidden="true">·</span>
                        <Badge variant={site.published ? "default" : "secondary"} className="rounded-full">
                          {site.published ? "Live" : "Draft"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/p/${encodeURIComponent(site.slug)}`)
                        }
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        View
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          router.push(`/sitebuilder/${encodeURIComponent(site.id)}`)
                        }
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </CollapsiblePanel>
        </div>
      </div>
    </main>
  );
}
