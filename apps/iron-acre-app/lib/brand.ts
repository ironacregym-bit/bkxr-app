// lib/brand.ts
export type Brand = "bxkr" | "iron-acre";

export function resolveBrandFromHost(host?: string | null): Brand {
  const h = String(host || "").toLowerCase();
  if (h.includes("ironacregym")) return "iron-acre";
  return "bxkr";
}

export const BRAND_CONFIG: Record<
  Brand,
  {
    label: string;
    accent: string;
    background: string;
  }
> = {
  "iron-acre": {
    label: "Iron Acre",
    accent: "#18FF9A",
    background: "#070A0F",
  },
  bxkr: {
    label: "BXKR",
    accent: "#FF8A2A",
    background: "#070A0F",
  },
};
