
// pages/iron-acre/index.tsx
import Head from "next/head";
import { getSession } from "next-auth/react";
import type { GetServerSideProps } from "next";
import BottomNav from "../../components/BottomNav";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  if (!session) {
    const callbackUrl = encodeURIComponent(context.resolvedUrl || "/iron-acre");
    return {
      redirect: { destination: `/register?callbackUrl=${callbackUrl}`, permanent: false },
    };
  }
  return { props: {} };
};

export default function IronAcreHome() {
  return (
    <>
      <Head>
        <title>Iron Acre Gym</title>
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <section className="futuristic-card p-3 mb-3">
          <h2 className="m-0">Iron Acre Gym</h2>
          <div className="text-dim mt-1">
            Performance dashboard is loading. Next we’ll add 1RM and gym progress views.
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
