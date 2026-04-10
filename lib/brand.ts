// lib/brand.ts

export type Brand = "bxkr" | "iron-acre";

export function resolveBrandFromHost(host?: string | null): Brand {
  const h = String(host || "").toLowerCase();

  // Match your Vercel subdomain(s)
  if (h.includes("ironacregym")) return "iron-acre";

  return "bxkr";
}
