
// pages/admin/index.tsx (AdminDashboard)
import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import BottomNav from "../../components/BottomNav";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";

  if (status === "loading") {
    return <div className="container py-4">Checking access…</div>;
  }

  if (!session || (role !== "admin" && role !== "gym")) {
    return (
      <div className="container py-4">
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const tiles = [
    { title: "Create Workout (BXKR)", icon: "fas fa-dumbbell", link: "/admin/workouts/create", color: "primary" },
    { title: "Create Exercise", icon: "fas fa-plus-circle", link: "/admin/exercises/create", color: "success" },
    { title: "Create Gym Workout", icon: "fas fa-weight-hanging", link: "/admin/workouts/gym-create", color: "warning" },
    { title: "Create Session", icon: "fas fa-calendar-plus", link: "/admin/sessions/create", color: "info" },
    { title: "Manage Bookings", icon: "fas fa-list", link: "/admin/bookings", color: "secondary" },
    { title: "Generate WhatsApp Link", icon: "fab fa-whatsapp", link: "/admin/share", color: "success" },
    { title: "Manage Users", icon: "fas fa-users", link: "/admin/users", color: "dark" },
  ];

  return (
    <>
      <Head><title>Admin Dashboard - BXKR</title></Head>
      <main className="container py-3" style={{ paddingBottom: "70px" }}>
        <h2 className="mb-4 text-center">Admin Dashboard</h2>
        <div className="row g-3">
          {tiles.map((tile, idx) => (
            <div key={idx} className="col-6 col-md-4">
              <Link href={tile.link} className="text-decoration-none">
                <div className={`card text-center p-3 shadow-sm border-${tile.color}`}>
                  <div className={`text-${tile.color} mb-2`}><i className={`${tile.icon} fa-2x`} /></div>
                  <h6 className="fw-bold">{tile.title}</h6>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
       </>
  );
}
