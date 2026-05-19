// File: pages/api/foods/search.ts
import type { NextApiRequest, NextApiResponse } from "next";

type Food = {
  id: string;
  code: string;
  name: string;
  brand: string;
  image: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: string | null;
};

type SearchResp = {
  foods: Food[];
  meta?: {
    q?: string;
    source?: "cache" | "live";
    timedOut?: boolean;
    tookMs?: number;
    count?: number;
  };
};

function toNum(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function pickName(p: any, fallback: string) {
  return (
    String(p?.product_name_en || "").trim() ||
    String(p?.product_name || "").trim() ||
    String(p?.generic_name_en || "").trim() ||
    String(p?.generic_name || "").trim() ||
    fallback
  );
}

function normaliseQuery(q: string) {
  return String(q || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function clampPageSize(n: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 30;
  return Math.max(10, Math.min(50, v));
}

function mapProductsWithRaw(products: any[], fallbackQuery: string): Array<{ raw: any; food: Food }> {
  const out: Array<{ raw: any; food: Food }> = [];

  for (const p of products || []) {
    const code = String(p?.code || "").trim();
    if (!code) continue;

    const nutr = p?.nutriments || {};
    const calories = toNum(nutr?.["energy-kcal_100g"] ?? nutr?.["energy_100g"]);

    const food: Food = {
      id: code,
      code,
      name: pickName(p, fallbackQuery),
      brand: String(p?.brands || "Unknown"),
      image: p?.image_front_small_url || p?.image_front_url || null,
      calories,
      protein: toNum(nutr?.proteins_100g),
      carbs: toNum(nutr?.carbohydrates_100g),
      fat: toNum(nutr?.fat_100g),
      servingSize: p?.serving_size || null,
    };

    out.push({ raw: p, food });
  }

  return out;
}

// Heuristics to rank “English/UK-ish” items higher
function scoreProduct(p: any, mapped: Food, tokens: string[]) {
  let score = 0;

  const nameEn = String(p?.product_name_en || "").trim();
  const genericEn = String(p?.generic_name_en || "").trim();
  const hasEnglishField = Boolean(nameEn || genericEn);
  if (hasEnglishField) score += 8;

  const countries = Array.isArray(p?.countries_tags) ? p.countries_tags.join(" ") : String(p?.countries_tags || "");
  if (/united-kingdom|en:united-kingdom|gb/i.test(countries)) score += 8;

  const langs = Array.isArray(p?.languages_tags) ? p.languages_tags.join(" ") : String(p?.languages_tags || "");
  if (/\ben:english\b|\ben\b/i.test(langs)) score += 4;

  if (/^[\x00-\x7F]*$/.test(mapped.name)) score += 2;

  const n = mapped.name.toLowerCase();
  const penalties = ["blanc", "poulet", "dinde", "jambon", "rôti", "charcuterie", "pollo", "pechuga", "frango", "filet", "nature", "sans nitrite"];
  for (const w of penalties) if (n.includes(w)) score -= 1;

  if (mapped.image) score += 1;
  if (mapped.brand && mapped.brand !== "Unknown") score += 1;

  const tokenScore = tokens.reduce((acc, t) => acc + (n.includes(t) ? 1 : 0), 0);
  score += tokenScore * 3;

  // Prefer items with at least some macro data, but do not exclude
  const hasAnyMacros = Boolean(mapped.calories || mapped.protein || mapped.carbs || mapped.fat);
  if (hasAnyMacros) score += 1;

  return score;
}

async function fetchJSONWithTimeout(url: string, timeoutMs: number): Promise<{ data: any | null; timedOut: boolean }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "Accept-Language": "en-GB,en;q=0.9",
        "User-Agent": "IronAcre/1.0 (nutrition-search)",
      },
    });
    if (!r.ok) return { data: null, timedOut: false };
    const data = await r.json().catch(() => null);
    return { data, timedOut: false };
  } catch (e: any) {
    const aborted = e?.name === "AbortError";
    return { data: null, timedOut: aborted };
  } finally {
    clearTimeout(t);
  }
}

// Simple in-memory cache (works well on warm lambda instances)
type CacheEntry = { at: number; ttlMs: number; value: SearchResp };
const CACHE: Map<string, CacheEntry> = (globalThis as any).__FOODS_SEARCH_CACHE__ || new Map();
(globalThis as any).__FOODS_SEARCH_CACHE__ = CACHE;

function cacheGet(key: string): SearchResp | null {
  const hit = CACHE.get(key);
  if (!hit) return null;
  const age = Date.now() - hit.at;
  if (age > hit.ttlMs) {
    CACHE.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: SearchResp, ttlMs: number) {
  CACHE.set(key, { at: Date.now(), ttlMs, value });
}

function buildSearchUrl(opts: {
  q: string;
  pageSize: number;
  onlyUK: boolean;
}) {
  const params = new URLSearchParams();
  params.set("search_terms", opts.q);
  params.set("search_simple", "1");
  params.set("action", "process");
  params.set("json", "1");
  params.set("page_size", String(opts.pageSize));
  params.set("lc", "en");
  params.set("tags_lc", "en");

  // Limit fields for speed (smaller payload, faster parse)
  params.set(
    "fields",
    [
      "code",
      "product_name_en",
      "product_name",
      "generic_name_en",
      "generic_name",
      "brands",
      "image_front_small_url",
      "image_front_url",
      "nutriments",
      "countries_tags",
      "languages_tags",
      "serving_size",
    ].join(",")
  );

  if (opts.onlyUK) {
    params.set("countries", "United Kingdom");
  }

  return `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<SearchResp>) {
  const started = Date.now();

  // Edge caching on Vercel is controlled via Cache-Control directives like s-maxage/stale-while-revalidate. [2](https://vercel.com/docs/caching/cdn-cache)[1](https://vercel.com/docs/caching/cache-control-headers)
  // Browser max-age=0 can lead to revalidation + 304s; the client should bypass browser cache with fetch(cache:'no-store') (we’ll fix in pages/nutrition.tsx).
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const queryRaw = String(req.query.query || "").trim();
  const barcode = String(req.query.barcode || "").trim();

  try {
    // Barcode lookup first
    if (barcode && barcode.length >= 6) {
      const cacheKey = `barcode:${barcode}`;
      const cached = cacheGet(cacheKey);
      if (cached) {
        return res.status(200).json({
          ...cached,
          meta: { ...(cached.meta || {}), source: "cache", tookMs: Date.now() - started, count: cached.foods.length },
        });
      }

      const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
      const { data, timedOut } = await fetchJSONWithTimeout(url, 6000);

      if (!data || data.status !== 1 || !data.product) {
        const payload: SearchResp = { foods: [], meta: { q: barcode, source: "live", timedOut, tookMs: Date.now() - started, count: 0 } };
        cacheSet(cacheKey, payload, 10 * 60_000);
        return res.status(200).json(payload);
      }

      const p = data.product;
      const nutr = p?.nutriments || {};
      const calories = toNum(nutr?.["energy-kcal_100g"] ?? nutr?.["energy_100g"]);

      const food: Food = {
        id: String(p.code || barcode),
        code: String(p.code || barcode),
        name: pickName(p, "Unknown"),
        brand: String(p.brands || "Unknown"),
        image: p.image_front_small_url || p.image_front_url || null,
        calories,
        protein: toNum(nutr?.proteins_100g),
        carbs: toNum(nutr?.carbohydrates_100g),
        fat: toNum(nutr?.fat_100g),
        servingSize: p?.serving_size || null,
      };

      const payload: SearchResp = { foods: food.code ? [food] : [], meta: { q: barcode, source: "live", timedOut, tookMs: Date.now() - started, count: food.code ? 1 : 0 } };
      cacheSet(cacheKey, payload, 60 * 60_000);
      return res.status(200).json(payload);
    }

    const q = normaliseQuery(queryRaw);
    if (!q || q.length < 2) {
      return res.status(200).json({ foods: [], meta: { q, source: "live", tookMs: Date.now() - started, count: 0 } });
    }

    const cacheKey = `q:${q}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return res.status(200).json({
        ...cached,
        meta: { ...(cached.meta || {}), source: "cache", tookMs: Date.now() - started, count: cached.foods.length },
      });
    }

    const pageSize = clampPageSize(Number(req.query.page_size || 30));
    const tokens = q.split(" ").filter(Boolean).slice(0, 5);

    // Try UK first, then global fallback
    const urlUK = buildSearchUrl({ q, pageSize, onlyUK: true });
    const ukRes = await fetchJSONWithTimeout(urlUK, 4000);
    const productsUK: any[] = Array.isArray(ukRes.data?.products) ? ukRes.data.products : [];
    const ukPairs = mapProductsWithRaw(productsUK, q);

    const haveEnoughUK = ukPairs.length >= 10;

    let globalTimedOut = false;
    let globalPairs: Array<{ raw: any; food: Food }> = [];

    if (!haveEnoughUK) {
      const urlGlobal = buildSearchUrl({ q, pageSize, onlyUK: false });
      const globalRes = await fetchJSONWithTimeout(urlGlobal, 4000);
      globalTimedOut = globalRes.timedOut;
      const productsGlobal: any[] = Array.isArray(globalRes.data?.products) ? globalRes.data.products : [];
      globalPairs = mapProductsWithRaw(productsGlobal, q);
    }

    // Merge + dedupe by code
    const mergedMap = new Map<string, { raw: any; food: Food }>();
    for (const x of ukPairs) if (!mergedMap.has(x.food.code)) mergedMap.set(x.food.code, x);
    for (const x of globalPairs) if (!mergedMap.has(x.food.code)) mergedMap.set(x.food.code, x);

    const merged = Array.from(mergedMap.values());

    // Rank
    merged.sort((A, B) => scoreProduct(B.raw, B.food, tokens) - scoreProduct(A.raw, A.food, tokens));

    const foods = merged.map((x) => x.food);
    const timedOut = Boolean(ukRes.timedOut || globalTimedOut);

    const payload: SearchResp = {
      foods,
      meta: { q, source: "live", timedOut, tookMs: Date.now() - started, count: foods.length },
    };

    // Cache: shorter TTL for very short queries (milk), longer for specific queries
    const ttl = q.length <= 4 ? 10 * 60_000 : 30 * 60_000;
    cacheSet(cacheKey, payload, ttl);

    return res.status(200).json(payload);
  } catch (err) {
    console.error("[foods/search] error:", err);
    return res.status(500).json({ foods: [], meta: { source: "live", tookMs: Date.now() - started, count: 0 } });
  }
}
