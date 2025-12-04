"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

export default function BottomNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = session?.user?.role;

  const baseItems = [
    { href: "/", icon: "fa-home", label: "Home" },
    { href: "/workout", icon: "fa-dumbbell", label: "Workout" },
    { href: "/nutrition", icon: "fa-utensils", label: "Nutrition" },
    { href: "/more", icon: "fa-ellipsis-h", label: "More" },
  ];

  const navItems =
    role === "admin" || role === "gym"
      ? [...baseItems, { href: "/admin", icon: "fa-user-shield", label: "Admin" }]
      : baseItems;

  return (
    <nav className="bxkr-bottom-nav">
      {navItems.map((item) => {
        const active = pathname === item.href;

        return (
          <Link key={item.href} href={item.href} className="bxkr-nav-item">
            <div className={`bxkr-nav-icon ${active ? "active" : ""}`}>
              <i className={`fas ${item.icon}`}></i>
            </div>
            <span className={`bxkr-nav-label ${active ? "active" : ""}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
