// lib/fonts.ts
import { Manrope } from "next/font/google";

export const appFont = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});
