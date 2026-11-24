// pages/iron-acre/login.tsx
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function IronAcreLoginPage() {
  const router = useRouter();

  useEffect(() => {
    const next =
      typeof router.query.callbackUrl === "string" && router.query.callbackUrl.trim()
        ? router.query.callbackUrl.trim()
        : "/";

    const ref =
      typeof router.query.ref === "string" && router.query.ref.trim()
        ? `&ref=${encodeURIComponent(router.query.ref.trim())}`
        : "";

    router.replace(
      `/register?brand=iron-acre&gym_id=g1&callbackUrl=${encodeURIComponent(next)}${ref}`
    );
  }, [router]);

  return (
    <>
      <Head>
        <title>Iron Acre Gym Login</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="flex min-h-screen items-center bg-ia-bg px-4 py-12 text-foreground">
        <section className="mx-auto w-full max-w-lg rounded-2xl border border-ia-border bg-ia-bg-alt p-7 text-center shadow-xl sm:p-9">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ia-primary/30 bg-ia-primary/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-ia-primary">
            Iron Acre Gym
          </div>

          <h1 className="font-display text-3xl font-bold">
            Taking you to gym login
          </h1>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Your account will be linked to Iron Acre Gym and you will land in your dashboard after sign in.
          </p>

          <div className="mt-6 flex justify-center">
            <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-border border-t-ia-primary" />
          </div>

        </section>
      </main>
    </>
  );
}
