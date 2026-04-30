// lib/fonts.ts
import { Plus_Jakarta_Sans } from "next/font/google";

export const appFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});
