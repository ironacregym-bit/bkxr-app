import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Container } from "./ui/container";

const links = [
  { href: "/outdoor-gym", label: "Outdoor gym" },
  { href: "/strongman-functional-training", label: "Strength" },
  { href: "/boxing", label: "Boxing" },
  { href: "/online-coaching", label: "Online coaching" },
  { href: "/pricing-times", label: "Prices & times" },
  { href: "/7-day-workout", label: "7-day workout" },
  { href: "/winter-arc", label: "Winter Arc 2027" },
];

type SiteHeaderProps = {
  variant?: "solid" | "overlay";
  ctaHref?: string;
  ctaLabel?: string;
};

export default function SiteHeader({
  variant = "solid",
  ctaHref = "/#start",
  ctaLabel = "First class free",
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOverlay = variant === "overlay";

  return (
    <header
      className={
        isOverlay
          ? "relative z-30 border-b border-white/10 bg-black/10"
          : "sticky top-0 z-30 border-b border-white/10 bg-[#141a15]/95 text-white backdrop-blur"
      }
    >
      <Container>
        <div className="flex min-h-[76px] items-center justify-between gap-5">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-3"
            aria-label="Iron Acre Gym home"
            onClick={() => setMenuOpen(false)}
          >
            <Image
              src="/images/iron_acre_logo_transparent.png"
              alt=""
              width={44}
              height={44}
              priority
              className="h-11 w-11 object-contain"
            />
            <span className="font-['Big_Shoulders_Display'] text-xl font-black uppercase sm:text-2xl">
              Iron Acre Gym
            </span>
          </Link>

          <nav
            aria-label="Main"
            className="hidden items-center gap-4 xl:flex"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap text-xs font-semibold text-white/75 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href={ctaHref}
              className="hidden rounded-md bg-[#cc5500] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#db6712] sm:inline-flex"
            >
              {ctaLabel}
            </Link>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/25 text-white hover:bg-white/10 xl:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-site-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="sr-only">
                {menuOpen ? "Close menu" : "Open menu"}
              </span>
              <span className="flex w-5 flex-col gap-1.5" aria-hidden="true">
                <span className="h-0.5 w-full bg-current" />
                <span className="h-0.5 w-full bg-current" />
                <span className="h-0.5 w-full bg-current" />
              </span>
            </button>
          </div>
        </div>

        <nav
          id="mobile-site-menu"
          aria-label="Mobile main"
          className={`border-t border-white/10 bg-[#141a15]/95 py-3 xl:hidden ${
            menuOpen ? "block" : "hidden"
          }`}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-md px-2 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 hover:text-white"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={ctaHref}
            className="mt-2 inline-flex w-full justify-center rounded-md bg-[#cc5500] px-4 py-3 text-sm font-bold text-white"
            onClick={() => setMenuOpen(false)}
          >
            {ctaLabel}
          </Link>
        </nav>
      </Container>
    </header>
  );
}
