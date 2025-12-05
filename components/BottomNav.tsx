
"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const pathname = usePathname();

  // Base nav items
  const navItems = [
    { href: "/", icon: "fa-home", label: "Home" },
    { href: "/workout", icon: "fa-dumbbell", label: "Train" },
    { href: "/nutrition", icon: "fa-utensils", label: "Nutrition" },
    { href: "/schedule", icon: "fa-calendar-alt", label: "Schedule" },
    { href: "/more", icon: "fa-ellipsis-h", label: "More" },
  ];

  // Move Admin inside More for admin/gym roles
  const moreHref = role === "admin" || role === "gym" ? "/more?admin=true" : "/more";

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        backdropFilter: "blur(12px)",
        borderRadius: "30px",
        padding: "12px 24px",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        width: "90%",
        maxWidth: "420px",
        zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
      }}
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href === "/more" && pathname.startsWith("/more"));
        return (
          <Link
            key={item.href}
            href={item.href === "/more" ? moreHref : item.href}
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
                boxShadow: isActive ? "0 0 12px #ff7f32" : "none", // Only active gets neon orange glow
              }}
            >
              <i
                className={`fas ${item.icon}`}
                style={{
                  fontSize: "22px",
                  color: isActive ? "#ff7f32" : "#fff", // Active icon orange, others white
                }}
              ></i>
            </div>
            <div
              style={{
                fontSize: "12px",
                marginTop: 6,
                opacity: isActive ? 1 : 0.8,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {item.label}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
