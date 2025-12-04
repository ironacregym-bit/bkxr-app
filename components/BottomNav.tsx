
"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function BottomNav() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const navItems = [
    { href: "/", icon: "fa-home", label: "Home" },
    { href: "/workout", icon: "fa-dumbbell", label: "Workout" },
    { href: "/nutrition", icon: "fa-utensils", label: "Nutrition" },
    { href: "/more", icon: "fa-ellipsis-h", label: "More" },
  ];

  if (role === "admin" || role === "gym") {
    navItems.push({
      href: "/admin",
      icon: "fa-user-shield",
      label: "Admin",
    });
  }

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(12px)",
        borderRadius: "30px",
        padding: "12px 24px",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        width: "90%",
        maxWidth: "420px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
        zIndex: 1000,
      }}
    >
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textDecoration: "none",
            color: "#fff",
            transition: "color 0.3s ease",
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              transition: "all 0.3s ease",
              boxShadow: "0 0 10px rgba(255,127,50,0.4)",
            }}
            className="nav-icon"
          >
            <i
              className={`fas ${item.icon}`}
              style={{
                fontSize: "22px",
                color: "#ff7f32", // Futuristic orange accent
              }}
            ></i>
          </div>
          <div style={{ fontSize: "12px", marginTop: 6, opacity: 0.8 }}>{item.label}</div>
        </Link>
      ))}
    </nav>
  );
}
