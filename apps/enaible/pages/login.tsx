import { useState } from "react";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import { Bot, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const authError = router.query.error;

  async function handleGoogleSignIn() {
    setError("");
    setSubmitting(true);
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch {
      setError("Could not start Google sign-in. Please try again.");
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
            <CardTitle className="text-2xl">Sign in to EnAIble</CardTitle>
            <CardDescription>
              Use your Google account to securely access your organisation
              workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(authError || error) && (
              <p
                aria-live="polite"
                className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                role="alert"
              >
                {error ||
                  "Google sign-in could not be completed. Please try again."}
              </p>
            )}
            <Button
              className="w-full"
              disabled={submitting}
              onClick={handleGoogleSignIn}
              type="button"
            >
              {submitting ? "Redirecting to Google..." : "Continue with Google"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
