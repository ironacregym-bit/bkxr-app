import { z } from "zod";

export const paymentProductSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).default(""),
  amountMinor: z.number().int().min(50).max(100_000_000),
  currency: z.enum(["gbp", "eur", "usd"]),
  active: z.boolean(),
});

export const paymentProductsPatchSchema = z.object({
  siteId: z.string().trim().min(1).max(128),
  enabled: z.boolean(),
  products: z.array(paymentProductSchema).max(50).refine(
    (products) => new Set(products.map((product) => product.id)).size === products.length,
    "Product IDs must be unique."
  ),
}).refine(
  (value) => !value.enabled || value.products.some((product) => product.active),
  { message: "Add at least one active product before enabling payments.", path: ["enabled"] }
);

export const checkoutRequestSchema = z.object({
  slug: z.string().trim().min(3).max(40).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  productId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
});

export const siteIdSchema = z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);

export function sanitizePublicPayments(value: any) {
  const enabled = Boolean(value?.enabled && value?.stripeAccountId);
  const products = Array.isArray(value?.products) ? value.products : [];
  return {
    enabled,
    products: enabled
      ? products
      .filter((product: any) =>
        product &&
        product.active === true &&
        /^[a-zA-Z0-9_-]{1,80}$/.test(String(product.id || "")) &&
        String(product.name || "").trim() &&
        Number.isSafeInteger(Number(product.amountMinor)) &&
        Number(product.amountMinor) >= 50 &&
        ["gbp", "eur", "usd"].includes(String(product.currency || "").toLowerCase())
      )
      .map((product: any) => ({
        id: String(product.id || ""),
        name: String(product.name || ""),
        description: String(product.description || ""),
        amountMinor: Number(product.amountMinor) || 0,
        currency: String(product.currency || "gbp"),
        active: true,
      }))
      : [],
  };
}
