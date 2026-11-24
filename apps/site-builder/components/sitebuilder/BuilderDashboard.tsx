import { useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { ArrowUpRight, Globe2, LoaderCircle, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="gap-1.5">
              <Globe2 className="h-3.5 w-3.5" />
              Site management
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              SiteBuilder
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Create and manage your hosted sites, custom domains, and published content.
            </p>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Create a new site
              </CardTitle>
              <CardDescription>Start with a name and a public URL slug.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your sites</CardTitle>
              <CardDescription>
                Edit content, control publishing, and preview live pages.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No sites yet. Create one to get started.
                </p>
              ) : null}

              <div className="divide-y divide-border">
                {sites.map((site) => (
                  <div
                    key={site.id}
                    className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="truncate font-medium">
                        {site.name || "Untitled"}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <code className="font-mono">/p/{site.slug}</code>
                        <span aria-hidden="true">·</span>
                        <Badge variant={site.published ? "default" : "secondary"}>
                          {site.published ? "Published" : "Draft"}
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

              <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                Custom domains are served at the root via middleware mapping. Add
                each client domain in Vercel and update the host map environment
                variable.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
