// pages/register.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Mail, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function normaliseQueryString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeCallbackUrl(value: string) {
  const cleaned = String(value || "").trim();

  if (!cleaned) return "/";
  if (cleaned.startsWith("/")) return cleaned;

  return "/";
}

export default function RegisterPage() {
  const router = useRouter();
  const { status } = useSession();

  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [busyEmail, setBusyEmail] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkingGym, setLinkingGym] = useState(false);

  const didRedirectRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const queryCallbackUrl = normaliseQueryString(router.query.callbackUrl);
  const queryGymId = normaliseQueryString(router.query.gym_id);
  const queryRef = normaliseQueryString(router.query.ref);

  const callbackUrl = useMemo(() => {
    return safeCallbackUrl(queryCallbackUrl || "/");
  }, [queryCallbackUrl]);

  const gymIdToJoin = useMemo(() => {
    return queryGymId || "";
  }, [queryGymId]);

  useEffect(() => {
    if (!mounted) return;
    if (typeof window === "undefined") return;

    localStorage.setItem(
      "app_brand",
      "iron-acre"
    );

    localStorage.setItem("post_login_callback", callbackUrl);

    if (gymIdToJoin) {
      localStorage.setItem("pending_gym_id", gymIdToJoin);
    }

    if (queryRef) {
      localStorage.setItem("iron_acre_ref", queryRef);
      localStorage.setItem("bxkr_ref", queryRef);
    }
  }, [mounted, callbackUrl, gymIdToJoin, queryRef]);

  useEffect(() => {
    if (!mounted) return;
    if (status !== "authenticated") return;
    if (didRedirectRef.current) return;

    const run = async () => {
      didRedirectRef.current = true;

      try {
        // Iron Acre login
        if (gymIdToJoin) {
          setLinkingGym(true);

          await fetch("/api/profile/join-gym", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              gym_id: gymIdToJoin,
            }),
          }).catch(() => null);
        }
      } finally {
        setLinkingGym(false);
        router.replace(callbackUrl || "/");
      }
    };

    run().catch(() => {
      router.replace(callbackUrl || "/");
    });
  }, [
    mounted,
    status,
    gymIdToJoin,
    callbackUrl,
    router,
  ]);

  async function handleGoogleSignIn() {
    setError(null);

    await signIn("google", {
      callbackUrl,
    });
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();

    setError(null);
    setSent(false);

    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusyEmail(true);

    try {
      const res = await signIn("email", {
        email: cleanEmail,
        callbackUrl,
        redirect: false,
      });

      if (res && !res.error) {
        setSent(true);
      } else {
        setError(res?.error || "Something went wrong sending your sign-in link.");
      }
    } catch {
      setError("Failed to send sign-in link. Please try again.");
    } finally {
      setBusyEmail(false);
    }
  }

  const loading = status === "loading" || linkingGym;

  return (
    <>
      <Head>
        <title>Sign in • Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Sign in to Iron Acre Gym to access your training, nutrition, progress tracking and member dashboard."
        />
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-ia-bg via-ia-bg-alt to-ia-bg px-4 py-8 pb-24 text-foreground sm:py-12">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8">
            <Link href="/" className="inline-flex items-center gap-3 text-foreground">
              <img
                className="h-12 w-12 object-contain"
                src="/iron_acre_logo_transparent.png"
                alt="Iron Acre Gym"
              />
              <span className="font-display text-2xl font-bold">IRON ACRE</span>
            </Link>
          </header>

          <div className="grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-start">
            <section className="space-y-4 py-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-ia-primary/30 bg-ia-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ia-primary">
                Member access
              </div>
              <h1 className="font-display text-5xl font-bold leading-none sm:text-6xl">
                Sign in to <span className="text-ia-primary">Iron Acre</span>
              </h1>
              <p className="max-w-lg text-base leading-7 text-muted-foreground">
                Continue with Google or request a secure sign-in link. Your account is created
                automatically the first time you sign in.
              </p>
              <div className="flex items-start gap-3 rounded-xl border border-border bg-card/70 p-4 text-sm leading-6 text-muted-foreground">
                <Route className="mt-1 h-4 w-4 shrink-0 text-ia-primary" aria-hidden="true" />
                <p>
                  New members will be guided through onboarding after signing in so we can set up
                  their profile, programme, and gym access.
                </p>
              </div>
            </section>

            <Card className="border-ia-border bg-ia-bg-alt/90">
              <CardHeader>
                <CardTitle className="font-display text-3xl">Member sign in</CardTitle>
                <CardDescription>
                  Choose a sign-in method to continue to your training dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  className="h-12 w-full"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  {linkingGym ? "Preparing your account..." : "Continue with Google"}
                </Button>

                <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or use email
                  <span className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={submitEmail} className="space-y-3">
                  <div className="ia-form-field">
                    <label className="ia-field-label" htmlFor="sign-in-email">
                      Email address
                    </label>
                    <Input
                      id="sign-in-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    className="h-12 w-full border-ia-primary/50 text-foreground hover:bg-ia-primary/10"
                    disabled={busyEmail || linkingGym}
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    {busyEmail ? "Sending sign-in link..." : "Email me a sign-in link"}
                  </Button>
                </form>

                {error ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground" role="alert">
                    {error}
                  </p>
                ) : null}

                {sent ? (
                  <p className="flex items-center gap-2 rounded-md border border-ia-sage/40 bg-ia-sage/10 p-3 text-sm text-foreground" aria-live="polite">
                    <CheckCircle2 className="h-4 w-4 text-ia-sage" aria-hidden="true" />
                    Sign-in link sent — check your inbox.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <footer className="mt-10 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Iron Acre Gym ·{" "}
            <Link className="text-ia-primary hover:underline" href="/privacy">Privacy</Link> ·{" "}
            <Link className="text-ia-primary hover:underline" href="/terms">Terms</Link>
          </footer>
        </div>
      </main>
    </>
  );
}
