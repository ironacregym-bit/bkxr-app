
"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../../../components/BottomNav";
import ExercisesContent from "../../../components/admin/exercises/Content"; // <-- updated path

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export default function CreateExercisesPage() {
  const mounted = useMounted();
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const isAllowed = !!session && (role === "admin" || role === "gym");

  const swrKey = mounted && isAllowed ? "/api/exercises?limit=500" : null;
  const { data } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const exercises = Array.isArray(data?.exercises) ? data!.exercises : [];

  return (
    <>
      <Head><title>Create Exercise • Admin</title></Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <Link href="/admin" className="btn btn-outline-secondary">← Back to Admin</Link>
        </div>

        {!mounted || status === "loading" ? (
          <div className="container py-4">Checking access…</div>
        ) : !isAllowed ? (
          <div className="container py-4">
            <h3>Access Denied</h3>
            <p>You do not have permission to view this page.</p>
          </div>
        ) : (
          <ExercisesContent exercises={exercises} />
        )}
      </main>

      <BottomNav />
    </>
  );
}
