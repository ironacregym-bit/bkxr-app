// File: pages/admin/workouts/gym-edit/[id].tsx

import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import BottomNav from "../../../../components/BottomNav";

export default function GymEditWorkoutRedirectPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const role = (session?.user as any)?.role || "user";
  const routeId = router.query.id;
  const editId = typeof routeId === "string" ? routeId.trim() : "";

  useEffect(() => {
    if (!router.isReady) return;
    if (status === "loading") return;

    if (!session || (role !== "admin" && role !== "gym")) {
      router.replace("/admin");
      return;
    }

    if (!editId) {
      router.replace("/admin/workouts");
      return;
    }

    // ✅ Always use the unified editor UI (GymCreateWorkout) which supports strength/% blocks
    router.replace(`/admin/workouts/gym-create?edit=${encodeURIComponent(editId)}`);
  }, [router.isReady, status, session, role, editId, router]);

  return (
    <>
      <Head>
        <title>Edit gym workout • Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="container py-3 text-white" style={{ paddingBottom: 90 }}>
        <div className="ia-tile ia-tile-pad">
          <div className="ia-page-title">Loading editor…</div>
          <div className="ia-page-subtitle">Redirecting to the updated workout editor.</div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
