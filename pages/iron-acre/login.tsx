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

      <main
        className="container py-4 text-white"
        style={{ minHeight: "100vh", display: "flex", alignItems: "center" }}
      >
        <section
          className="ia-tile ia-tile-pad"
          style={{
            width: "100%",
            maxWidth: 520,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
              borderRadius: 999,
              padding: "7px 12px",
              background: "rgba(36,255,160,0.14)",
              border: "1px solid rgba(36,255,160,0.22)",
              color: "#24FFA0",
              fontSize: ".78rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Iron Acre Gym
          </div>

          <div className="ia-page-title" style={{ marginBottom: 8 }}>
            Taking you to gym login
          </div>

          <div className="ia-page-subtitle" style={{ maxWidth: 420, margin: "0 auto" }}>
            Your account will be linked to Iron Acre Gym and you will land in your dashboard after sign in.
          </div>

          <div className="mt-4">
            <div
              style={{
                width: 44,
                height: 44,
                margin: "0 auto",
                borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.12)",
                borderTopColor: "#24FFA0",
                animation: "iaSpin 1s linear infinite",
              }}
            />
          </div>

          <style jsx>{`
            @keyframes iaSpin {
              from {
                transform: rotate(0deg);
              }
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </section>
      </main>
    </>
  );
}
