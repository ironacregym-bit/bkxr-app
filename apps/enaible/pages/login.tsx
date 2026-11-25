import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { ArrowRight, Bot, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getFirebaseAuth } from "@/lib/firebase-client";

export default function LoginPage() {
  const [mode, setMode] = useState<"sign-in" | "register">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const auth = getFirebaseAuth();
      const credential =
        mode === "register"
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      const sessionResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!sessionResponse.ok) {
        const result = await sessionResponse.json();
        throw new Error(result.error || "Could not start your session");
      }

      if (mode === "register") {
        const organizationResponse = await fetch("/api/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: organizationName }),
        });
        const result = await organizationResponse.json();

        if (!organizationResponse.ok) {
          throw new Error(
            result.error || "Could not create your organisation"
          );
        }

        const selectResponse = await fetch("/api/organizations/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId: result.organization.tenantId,
          }),
        });
        if (!selectResponse.ok) {
          const selectionError = await selectResponse.json();
          throw new Error(
            selectionError.error || "Could not select your organisation"
          );
        }
      }

      window.location.assign("/");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Sign-in failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.12),transparent_55%)]" />
      <div className="relative grid w-full max-w-5xl gap-12 lg:grid-cols-[1fr_420px] lg:items-center">
        <section className="hidden lg:block">
          <div className="mb-8 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            EnAIble platform
          </p>
          <h1 className="max-w-xl text-5xl font-semibold leading-tight tracking-tight">
            Practical AI workflows, built around your business.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
            Configure agents, connect your operations and keep people in
            control of important decisions.
          </p>
          <div className="mt-9 flex items-center gap-3 text-sm text-muted-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Organisation-scoped access with server-verified sessions
          </div>
        </section>

        <Card className="border-white/10 bg-card/90 shadow-2xl shadow-black/20 backdrop-blur">
          <CardHeader>
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary lg:hidden">
              <Bot className="h-5 w-5" />
            </div>
            <CardTitle className="text-2xl">
              {mode === "register" ? "Create your workspace" : "Welcome back"}
            </CardTitle>
            <CardDescription>
              {mode === "register"
                ? "Set up your EnAIble account and organisation."
                : "Sign in to your organisation workspace."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "register" && (
                <label className="block space-y-2 text-sm font-medium">
                  Organisation name
                  <Input
                    autoComplete="organization"
                    maxLength={80}
                    minLength={2}
                    onChange={(event) =>
                      setOrganizationName(event.target.value)
                    }
                    required
                    value={organizationName}
                  />
                </label>
              )}
              <label className="block space-y-2 text-sm font-medium">
                Email
                <Input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Password
                <Input
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>

              {error && (
                <p
                  aria-live="polite"
                  className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <Button className="w-full" disabled={submitting} type="submit">
                {submitting
                  ? "Please wait..."
                  : mode === "register"
                    ? "Create workspace"
                    : "Sign in"}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "register"
                ? "Already have an account?"
                : "New to EnAIble?"}{" "}
              <button
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setMode(mode === "register" ? "sign-in" : "register");
                  setError("");
                }}
                type="button"
              >
                {mode === "register" ? "Sign in" : "Create an account"}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
