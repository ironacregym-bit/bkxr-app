
import Head from "next/head";
import { useSession } from "next-auth/react";
import Link from "next/link";
import BottomNav from "../components/BottomNav";


export default function MorePage() {
  const { data: session } = useSession();

  return (
    <Head>
      <title>BXKR</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
    </Head>
    <main className="container py-4" style={{ color: "#fff" }}>
      <div className="text-center mb-4">
        <img
          src={session?.user?.image || "/default-avatar.png"}
          alt="Profile"
          className="rounded-circle border"
          style={{ width: 80, height: 80, objectFit: "cover" }}
        />
        <h5 className="mt-2">{session?.user?.name || "Your Profile"}</h5>
      </div>

      <ul className="list-group" style={{ background: "transparent" }}>
        {[
          { href: "/profile", label: "Profile" },
          { href: "/check-ins", label: "Check Ins" },
          { href: "/supplements", label: "Supplements" },
          { href: "/progress", label: "Progress Data & Photos" },
          { href: "/exercise-library", label: "Exercise Library" },
          {
            href: `https://wa.me/${process.env.NEXT_PUBLIC_TRAINER_PHONE}?text=Hi%20Coach%20I%27m%20doing%20BXKR`,
            label: "Chat",
            external: true,
          },
        ].map((item) => (
          <li
            key={item.href}
            className="list-group-item"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "none",
              marginBottom: "8px",
              borderRadius: "8px",
            }}
          >
            {item.external ? (
              <a href={item.href} target="_blank" rel="noreferrer" style={{ color: "#fff", textDecoration: "none" }}>
                {item.label}
              </a>
            ) : (
              <Link href={item.href} style={{ color: "#fff", textDecoration: "none" }}>
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </main>
    <BottomNav />
  );
}
