
// pages/admin/users.tsx
"use client";

import Head from "next/head";
import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const isSignedIn = !!session?.user?.email;

  const { data, error, isLoading } = useSWR(
    isSignedIn ? "/api/admin/users" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const users = Array.isArray(data?.users) ? data!.users : [];

  return (
    <>
      <Head>
        <title>Admin • Users</title>
      </Head>
      <main className="container py-3" style={{ color: "#fff" }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="mb-0" style={{ fontWeight: 700 }}>Users</h2>
          <Link href="/admin" className="btn btn-bxkr-outline">← Admin</Link>
        </div>

        {!isSignedIn && <div className="bxkr-card p-3">Please sign in to view users.</div>}
        {isLoading && <div className="bxkr-card p-3">Loading…</div>}
        {error && <div className="bxkr-card p-3 text-danger">Failed to load users.</div>}

        {users.length === 0 && !isLoading && !error && (
          <div className="bxkr-card p-3">No users found.</div>
        )}

        <div className="row g-3">
          {users.map((u: any) => (
            <div key={u.email} className="col-12">
              <div className="bxkr-card p-3 d-flex justify-content-between align-items-center">
                <div>
                  <div className="fw-semibold">{u.name || u.email}</div>
                  <div className="small text-dim">
                    {u.email} • {u.role || "user"} • {u.location || "—"}
                  </div>
                </div>
                <Link href={`/admin/users/${encodeURIComponent(u.email)}`} className="btn btn-bxkr-outline">
                  Manage
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
