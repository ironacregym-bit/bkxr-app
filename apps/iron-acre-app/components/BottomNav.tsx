"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Activity, Dumbbell, Ellipsis, House, Utensils } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", icon: House, label: "Home" },
  { href: "/workout", icon: Dumbbell, label: "Train" },
  { href: "/nutrition-home", icon: Utensils, label: "Nutrition" },
  { href: "/progress", icon: Activity, label: "Progress" },
  { href: "/more", icon: Ellipsis, label: "More" },
];

export default function BottomNav() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const pathname = usePathname() || "";

  const moreHref = role === "admin" || role === "gym" ? "/more?admin=true" : "/more";

  return (
    <>
      <div aria-hidden="true" className="h-[calc(72px+env(safe-area-inset-bottom,0px)+10px)]" />

      <nav
        className="fixed inset-x-0 bottom-0 z-[1000] flex min-h-[72px] items-stretch justify-around border-t border-border bg-ia-bg/95 px-2.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-[0_-10px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl"
        aria-label="Bottom navigation"
      >
        {NAV_ITEMS.map((item) => {
          const targetHref = item.href === "/more" ? moreHref : item.href;

          const isNutrition = item.href === "/nutrition-home";
          const isTrain = item.href === "/workout";
          const isHome = item.href === "/";

          const isActive =
            pathname === targetHref ||
            (isHome && (pathname === "/" || pathname === "/iron-acre")) ||
            (item.href === "/more" && pathname.startsWith("/more")) ||
            (item.href === "/progress" && pathname.startsWith("/progress")) ||
            (isTrain &&
              (pathname.startsWith("/workout") ||
                pathname.startsWith("/gymworkout") ||
                pathname.startsWith("/train"))) ||
            (isNutrition &&
              (pathname.startsWith("/nutrition-home") || pathname.startsWith("/nutrition")));

          return (
            <Link
              key={item.href}
              href={targetHref}
              className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors"
              aria-current={isActive ? "page" : undefined}
            >
              <span
                aria-hidden="true"
                className={`absolute top-0 h-[3px] w-6 rounded-full bg-ia-primary transition-opacity ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
              <item.icon
                className={`h-5 w-5 transition-transform ${
                  isActive ? "-translate-y-0.5 text-ia-primary" : "text-ia-muted"
                }`}
                aria-hidden="true"
              />
              <span
                className={`whitespace-nowrap text-[11px] leading-none ${
                  isActive ? "font-bold text-ia-primary" : "text-ia-muted"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
