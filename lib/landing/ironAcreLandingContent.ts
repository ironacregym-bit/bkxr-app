// lib/landing/ironAcreLandingContent.ts
import { IRON_ACRE_LINKS } from "../links/ironAcreLinks";

export type PathCard = {
  title: string;
  body: string;
  href: string;
  cta: string;
  icon: string;
  badge?: string;
};

export type SocialLink = {
  label: string;
  href: string;
  icon: string;
};

export type FAQItem = {
  q: string;
  a: string;
};

export const PATH_CARDS: PathCard[] = [
  {
    title: "Iron Acre App",
    body: "Training, tracking and digital coaching built for real progress.",
    href: IRON_ACRE_LINKS.appSignup,
    cta: "App sign up",
    icon: "fa-mobile-alt",
    badge: "Coming soon",
  },
  {
    title: "Iron Acre Gym",
    body: "Outdoor strength and conditioning with a different kind of atmosphere.",
    href: IRON_ACRE_LINKS.gymInterest,
    cta: "Register interest",
    icon: "fa-dumbbell",
    badge: "Founding Members",
  },
  {
    title: "Iron Acre Podcast",
    body: "Training, mindset, consistency and building something different.",
    href: IRON_ACRE_LINKS.podcast,
    cta: "Watch on YouTube",
    icon: "fa-podcast",
    badge: "Placeholder",
  },
];

export const SOCIALS: SocialLink[] = [
  {
    label: "Instagram",
    href: IRON_ACRE_LINKS.socials.instagram,
    icon: "fa-instagram",
  },
  {
    label: "YouTube",
    href: IRON_ACRE_LINKS.socials.youtube,
    icon: "fa-youtube",
  },
  {
    label: "Facebook",
    href: IRON_ACRE_LINKS.socials.facebook,
    icon: "fa-facebook-f",
  },
  {
    label: "TikTok",
    href: IRON_ACRE_LINKS.socials.tiktok,
    icon: "fa-tiktok",
  },
];

export const FAQS: FAQItem[] = [
  {
    q: "Is Iron Acre a gym or an app?",
    a: "Iron Acre is the wider brand. Iron Acre Gym is the in-person training arm and the app is the digital arm, so people can connect with the brand in the way that suits them best.",
  },
  {
    q: "Can I join before launch?",
    a: "Yes. The Founding Members page is the best place to register interest, shape the timetable and access early launch offers.",
  },
  {
    q: "Will the app work without joining the gym?",
    a: "Yes. The long-term aim is for Iron Acre App users to get value whether they train with us in person or not.",
  },
  {
    q: "What kind of training does Iron Acre focus on?",
    a: "Strength, conditioning, kettlebells, outdoor sessions, consistency and proper long-term progress rather than gimmicks.",
  },
];
