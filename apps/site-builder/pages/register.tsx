import { useState, type FormEvent } from "react";
import Head from "next/head";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const result = await signIn("email", {
        email,
        callbackUrl: "/sitebuilder",
        redirect: false,
      });
      if (result?.error) {
        setError("Email sign-in is unavailable. Try Google or contact support.");
      } else {
        setMessage("If email sign-in is enabled, a link will arrive shortly.");
      }
    } catch {
      setError("Could not send a sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sign in | SiteBuilder</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in to SiteBuilder</CardTitle>
            <CardDescription>Use your account to manage your sites.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Button
              variant="default"
              className="w-full"
              onClick={() => signIn("google", { callbackUrl: "/sitebuilder" })}
            >
              Continue with Google
            </Button>
            <form className="space-y-3" onSubmit={submitEmail}>
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {message}
                </p>
              ) : null}
              <Button className="w-full" variant="outline" type="submit" disabled={busy}>
                {busy ? "Sending link..." : "Send a sign-in link"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
