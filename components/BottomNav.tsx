// components/BottomNav.tsx
"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

const NAV_HEIGHT = 72;

export default function BottomNav() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const pathname = usePathname() || "";

  const navItems = useMemo(
    () => [
      { href: "/", icon: "fa-home", label: "Home" },
      { href: "/train", icon: "fa-dumbbell", label: "Train" },
      { href: "/nutrition-home", icon: "fa-utensils", label: "Nutrition" },
      { href: "/progress", icon: "fa-chart-line", label: "Progress" },
      { href: "/more", icon: "fa-ellipsis-h", label: "More" },
    ],
    []
  );

  const moreHref = role === "admin" || role === "gym" ? "/more?admin=true" : "/more";

  return (
    <>
      {/* Spacer so page content never gets hidden behind fixed bottom nav */}
      <div
        aria-hidden="true"
        style={{
          height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px) + 10px)`,
          flexShrink: 0,
        }}
      />

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
          alignItems: "stretch",
          minHeight: NAV_HEIGHT,
          padding: "8px 10px calc(8px + env(safe-area-inset-bottom, 0px))",
          background: "rgba(6,10,15,0.94)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 -10px 30px rgba(0,0,0,0.28)",
        }}
      >
        {navItems.map((item) => {
          const targetHref = item.href === "/more" ? moreHref : item.href;

          const isNutrition = item.href === "/nutrition-home";
          const isTrain = item.href === "/train";
          const isHome = item.href === "/";

          const isActive =
            pathname === targetHref ||
            (isHome && pathname === "/iron-acre") ||
            (item.href === "/more" && pathname.startsWith("/more")) ||
            (item.href === "/progress" && pathname.startsWith("/progress")) ||
            (isTrain &&
              (pathname.startsWith("/train") ||
                pathname.startsWith("/gymworkout") ||
                pathname.startsWith("/workout"))) ||
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
                display: "flex",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  padding: "4px 0 2px",
                }}
              >
                {/* Active top highlight */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: -8,
                    width: isActive ? 28 : 0,
                    height: 3,
                    borderRadius: 999,
                    background: "var(--ia-neon, #23ff96)",
                    boxShadow: isActive ? "0 0 16px rgba(35,255,150,0.45)" : "none",
                    opacity: isActive ? 1 : 0,
                    transition: "all 0.2s ease",
                  }}
                />

                <div
                  className="nav-icon"
                  style={{
                    width: 24,
                    height: 24,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    transition: "transform 0.2s ease, color 0.2s ease",
                    transform: isActive ? "translateY(-1px)" : "translateY(0)",
                  }}
                >
                  <i
                    className={`fas ${item.icon}`}
                    aria-hidden="true"
                    style={{
                      fontSize: 18,
                      color: isActive
                        ? "var(--ia-neon, #23ff96)"
                        : "rgba(255,255,255,0.85)",
                      textShadow: isActive ? "0 0 14px rgba(35,255,150,0.28)" : "none",
                      transition: "all 0.2s ease",
                    }}
                  />
                </div>

                <div
                  style={{
                    fontSize: 11,
                    lineHeight: 1,
                    color: isActive
                      ? "var(--ia-neon, #23ff96)"
                      : "rgba(255,255,255,0.78)",
                    opacity: isActive ? 1 : 0.9,
                    fontWeight: isActive ? 700 : 500,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    transform: "translateY(-1px)",
                    transition: "all 0.2s ease",
                    letterSpacing: isActive ? "0.01em" : "0",
                  }}
                >
                  {item.label}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
