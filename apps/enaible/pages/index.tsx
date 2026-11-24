import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/router";
import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getFirebaseAuth } from "@/lib/firebase-client";
import type { OrganizationMembership } from "@/lib/schemas";

type User = {
  uid: string;
  email: string | null;
  name: string | null;
};

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Agents", icon: Bot },
  { label: "Workflows", icon: Workflow },
  { label: "Tasks & approvals", icon: CheckCircle2 },
  { label: "Documents", icon: FileText },
  { label: "Activity & logs", icon: Activity },
  { label: "Organisation settings", icon: Settings2 },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<
    OrganizationMembership[]
  >([]);
  const [activeOrganization, setActiveOrganization] =
    useState<OrganizationMembership | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const userResponse = await fetch("/api/auth/me");
      if (userResponse.status === 401) {
        await router.replace("/login");
        return;
      }
      const userResult = await userResponse.json();
      if (!userResponse.ok) {
        throw new Error(userResult.error || "Could not load your account");
      }
      setUser(userResult.user);

      const organizationsResponse = await fetch("/api/organizations");
      const organizationsResult = await organizationsResponse.json();
      if (!organizationsResponse.ok) {
        throw new Error(
          organizationsResult.error || "Could not load organisations"
        );
      }
      setOrganizations(organizationsResult.organizations);

      const activeResponse = await fetch("/api/organizations/active");
      if (activeResponse.ok) {
        const activeResult = await activeResponse.json();
        setActiveOrganization(activeResult.organization);
      } else if (activeResponse.status === 403) {
        setActiveOrganization(null);
      } else if (activeResponse.status === 401) {
        await router.replace("/login");
        return;
      } else {
        const activeError = await activeResponse.json();
        throw new Error(
          activeError.error || "Could not load the active organisation"
        );
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load your workspace"
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function selectOrganization(tenantId: string) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/organizations/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const result =
        response.status === 204 ? {} : await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not select organisation");
      }
      await loadWorkspace();
    } catch (selectError) {
      setError(
        selectError instanceof Error
          ? selectError.message
          : "Could not select organisation"
      );
    } finally {
      setSaving(false);
    }
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: organizationName }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not create organisation");
      }
      setOrganizationName("");
      await selectOrganization(result.organization.tenantId);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create organisation"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    await signOut(getFirebaseAuth());
    await router.replace("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your secure workspace...
      </main>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-border/80 bg-card/50 md:flex md:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border/80 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">EnAIble</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-5">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <div
                aria-current={item.active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${
                  item.active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground"
                }`}
                key={item.label}
                title={
                  item.active
                    ? undefined
                    : "Available in a later platform milestone"
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-border/80 p-4">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium">
              {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user.name || user.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {activeOrganization?.role || "Account"}
              </p>
            </div>
            <button
              aria-label="Sign out"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={handleSignOut}
              type="button"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-border/80 px-5 md:px-8">
          <div className="flex items-center gap-3">
            <Menu className="h-5 w-5 text-muted-foreground md:hidden" />
            <div>
              <p className="text-xs text-muted-foreground">Workspace</p>
              <select
                aria-label="Select organisation"
                className="max-w-64 bg-transparent text-sm font-medium outline-none"
                disabled={saving || organizations.length === 0}
                onChange={(event) =>
                  selectOrganization(event.target.value)
                }
                value={activeOrganization?.tenantId || ""}
              >
                {!activeOrganization && (
                  <option className="bg-card" value="">
                    Select organisation
                  </option>
                )}
                {organizations.map((organization) => (
                  <option
                    className="bg-card"
                    key={organization.tenantId}
                    value={organization.tenantId}
                  >
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Secure workspace
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-5 py-9 md:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-primary">
                {activeOrganization?.name || "Getting started"}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                {activeOrganization
                  ? "Your dashboard"
                  : "Set up your organisation"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {activeOrganization
                  ? "Your organisation workspace is ready for its first agent."
                  : "Create an organisation or choose one you already belong to."}
              </p>
            </div>
            <Button
              className="md:hidden"
              onClick={handleSignOut}
              variant="outline"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>

          {error && (
            <div
              className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              role="alert"
            >
              {error}
            </div>
          )}

          {!activeOrganization ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Create an organisation</CardTitle>
                  <CardDescription>
                    You will become its owner and can invite teammates in a
                    later milestone.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="flex flex-col gap-3 sm:flex-row"
                    onSubmit={createOrganization}
                  >
                    <Input
                      aria-label="Organisation name"
                      maxLength={80}
                      minLength={2}
                      onChange={(event) =>
                        setOrganizationName(event.target.value)
                      }
                      placeholder="e.g. Acme Operations"
                      required
                      value={organizationName}
                    />
                    <Button disabled={saving} type="submit">
                      Create
                    </Button>
                  </form>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Your organisations</CardTitle>
                  <CardDescription>
                    Select a workspace you have already been added to.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {organizations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No other organisations are linked to your account.
                    </p>
                  ) : (
                    organizations.map((organization) => (
                      <button
                        className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
                        disabled={saving}
                        key={organization.tenantId}
                        onClick={() =>
                          selectOrganization(organization.tenantId)
                        }
                        type="button"
                      >
                        <span>
                          <span className="block text-sm font-medium">
                            {organization.name}
                          </span>
                          <span className="text-xs capitalize text-muted-foreground">
                            {organization.role.replace("_", " ")}
                          </span>
                        </span>
                        <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" />
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Active agents",
                    value: "0",
                    note: "No agents deployed",
                    icon: Bot,
                  },
                  {
                    label: "Executions",
                    value: "0",
                    note: "Ready when you are",
                    icon: Activity,
                  },
                  {
                    label: "Pending approvals",
                    value: "0",
                    note: "Nothing needs review",
                    icon: CheckCircle2,
                  },
                  {
                    label: "Documents processed",
                    value: "0",
                    note: "Private to this organisation",
                    icon: FileText,
                  },
                ].map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <Card key={metric.label}>
                      <CardContent className="flex items-start justify-between p-5">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {metric.label}
                          </p>
                          <p className="mt-2 text-3xl font-semibold">
                            {metric.value}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {metric.note}
                          </p>
                        </div>
                        <span className="rounded-lg bg-primary/10 p-2 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent activity</CardTitle>
                    <CardDescription>
                      Events from your organisation&apos;s agents and workflows.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center py-10 text-center">
                      <span className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">
                        <Activity className="h-5 w-5" />
                      </span>
                      <p className="text-sm font-medium">No activity yet</p>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        Activity will appear here as your organisation starts
                        running configured workflows.
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Next steps</CardTitle>
                    <CardDescription>
                      The platform foundation is in place.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          Organisation workspace created
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tenant-scoped membership and owner role are active.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <CircleHelp className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          Configure your first agent
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Agent configuration and workflow runtime are planned
                          for the next platform milestone.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
