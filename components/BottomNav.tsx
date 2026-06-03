// components/BottomNav.tsx
"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

export default function BottomNav() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const pathname = usePathname() || "";

  const navItems = useMemo(
    () => [
      { href: "/", icon: "fa-home", label: "Home" },
      { href: "/workout", icon: "fa-dumbbell", label: "Train" },
      { href: "/nutrition-home", icon: "fa-utensils", label: "Nutrition" },
      { href: "/progress", icon: "fa-chart-line", label: "Progress" },
      { href: "/more", icon: "fa-ellipsis-h", label: "More" },
    ],
    []
  );

  const moreHref = role === "admin" || role === "gym" ? "/more?admin=true" : "/more";

  return (
    <nav
      className="bottom-nav"
      role="navigation"
      aria-label="Bottom navigation"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "8px 10px calc(8px + env(safe-area-inset-bottom, 0px))",
        background: "rgba(10,14,20,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.24)",
      }}
    >
      {navItems.map((item) => {
        const targetHref = item.href === "/more" ? moreHref : item.href;

        const isNutrition = item.href === "/nutrition-home";
        const isActive =
          pathname === targetHref ||
          (item.href === "/more" && pathname.startsWith("/more")) ||
          (item.href === "/progress" && pathname.startsWith("/progress")) ||
          (isNutrition &&
            (pathname.startsWith("/nutrition-home") || pathname.startsWith("/nutrition")));

        return (
          <Link
            key={item.href}
            href={targetHref}
            className="bxkr-bottomnav-link"
            aria-current={isActive ? "page" : undefined}
            style={{
              textDecoration: "none",
              color: "inherit",
              flex: 1,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <div
                className="nav-icon"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: isActive ? "rgba(255,127,50,0.16)" : "rgba(255,255,255,0.06)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  transition: "all 0.2s ease",
                  boxShadow: isActive ? "0 0 14px rgba(255,127,50,0.30)" : "none",
                  border: isActive
                    ? "1px solid rgba(255,127,50,0.30)"
                    : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <i
                  className={`fas ${item.icon}`}
                  aria-hidden="true"
                  style={{
                    fontSize: 18,
                    color: isActive ? "#ff7f32" : "#ffffff",
                  }}
                />
              </div>

              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1,
                  color: isActive ? "#ff7f32" : "rgba(255,255,255,0.88)",
                  opacity: isActive ? 1 : 0.82,
                  fontWeight: isActive ? 700 : 500,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
