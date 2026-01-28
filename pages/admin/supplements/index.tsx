"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../../../components/BottomNav";
import SupplementsContent from "../../../components/admin/supplements/Content";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export default function AdminSupplementsPage() {
  const mounted = useMounted();
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const isAllowed = !!session && (role === "admin" || role === "gym");

  const swrKey = mounted && isAllowed ? "/api/supplements" : null;
  const { data, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const supplements = Array.isArray(data?.supplements) ? data.supplements : [];

  return (
    <>
      <Head><title>Supplements • Admin</title></Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="d-flex justify-content-between mb-3">
          <Link href="/admin" className="btn btn-outline-secondary">
            ← Back to Admin
          </Link>
        </div>

        {!mounted || status === "loading" ? (
          <div>Checking access…</div>
        ) : !isAllowed ? (
          <div>
            <h3>Access Denied</h3>
          </div>
        ) : (
          <SupplementsContent supplements={supplements} onChange={mutate} />
        )}
      </main>

      <BottomNav />
    </>
  );
}