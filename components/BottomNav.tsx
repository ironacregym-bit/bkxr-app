
"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

export default function BottomNav() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const pathname = usePathname() || "";

  // Target routes (send Nutrition to the new home)
  const navItems = useMemo(
    () => [
      { href: "/", icon: "fa-home", label: "Home" },
      { href: "/workout", icon: "fa-dumbbell", label: "Train" },
      // ✅ point to the new Nutrition Home
      { href: "/nutrition-home", icon: "fa-utensils", label: "Nutrition" },
      { href: "/progress", icon: "fa-chart-line", label: "Progress" },
      { href: "/more", icon: "fa-ellipsis-h", label: "More" },
    ],
    []
  );

  // Keep Admin inside /more for admin/gym roles
  const moreHref = role === "admin" || role === "gym" ? "/more?admin=true" : "/more";

  return (
    <nav
      className="bottom-nav"
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 30,
        padding: "12px 24px",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        width: "90%",
        maxWidth: 420,
        zIndex: 1000,
        background: "rgba(10,14,20,0.65)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
      role="navigation"
      aria-label="Bottom navigation"
    >
      {navItems.map((item) => {
        const targetHref = item.href === "/more" ? moreHref : item.href;

        // ✅ Active logic (supports /nutrition-home and legacy /nutrition)
        const isNutrition = item.href === "/nutrition-home";
        const isActive =
          pathname === targetHref ||
          // Mark /more active for nested routes
          (item.href === "/more" && pathname.startsWith("/more")) ||
          // Mark /progress active for future nested routes
          (item.href === "/progress" && pathname.startsWith("/progress")) ||
          // Nutrition active on both new and legacy paths
          (isNutrition && (pathname.startsWith("/nutrition-home") || pathname.startsWith("/nutrition")));

        return (
          <Link
            key={item.href}
            href={targetHref}
            className="bxkr-bottomnav-link"
            aria-current={isActive ? "page" : undefined}
            style={{
              textDecoration: "none",
            }}
          >
            <div
              className="nav-icon"
              style={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.08)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                transition: "all 0.3s ease",
                boxShadow: isActive ? "0 0 12px #ff7f32" : "none",
              }}
            >
              <i
                className={`fas ${item.icon}`}
                style={{
                  fontSize: 22,
                  color: isActive ? "#ff7f32" : "#fff",
                }}
                aria-hidden="true"
              />
            </div>
            <div
              style={{
                fontSize: 12,
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
