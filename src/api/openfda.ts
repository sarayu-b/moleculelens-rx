// src/api/openfda.ts — look up a drug product by UPC or product NDC (openFDA, no key)
import { ndcCandidates, packageNdcCandidates } from "../logic/barcode";
import { ndcToIngredient } from "./rxnorm";

export type FdaProduct = { brandName?: string; genericName?: string; ingredient?: string };
export type BarcodeMatch = FdaProduct & { method: string };

// openFDA's no-key limit is shared per network IP; surface it separately from "not found".
export class OpenFdaRateLimitError extends Error {
  constructor() {
    super("openFDA's free lookup limit is used up for this network. Try again later or switch to cellular data.");
  }
}

const TIMEOUT_MS = 8000;
// Optional: raises the limit from 1,000/day per IP. EXPO_PUBLIC_ vars are inlined into the app bundle
// at build time, so this is not a secret; it lives in the git-ignored .env (see .env.example).
const API_KEY = process.env.EXPO_PUBLIC_OPENFDA_KEY;

async function query(search: string): Promise<FdaProduct | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Encode the quotes (iOS URL parsing can reject raw `"`); openFDA decodes %22 the same way.
    const keyParam = API_KEY ? `&api_key=${encodeURIComponent(API_KEY)}` : "";
    const url = `https://api.fda.gov/drug/ndc.json?search=${search.replace(/"/g, "%22")}&limit=1${keyParam}`;
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 404) return null; // openFDA answers "no matches" with 404
    if (res.status === 429) throw new OpenFdaRateLimitError();
    if (!res.ok) throw new Error(`openFDA HTTP ${res.status}`);
    const data = await res.json();
    const r = data.results?.[0];
    if (!r) return null;
    return { brandName: r.brand_name, genericName: r.generic_name, ingredient: r.active_ingredients?.[0]?.name };
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("openFDA took too long to answer.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// openFDA stores UPCs zero-padded to 13 digits.
export const lookupUpc = (upc12: string) => query(`openfda.upc:"0${upc12}"`);
export const lookupProductNdc = (productNdc: string) => query(`product_ndc:"${productNdc}"`);

async function resolveWithOpenFda(upc12: string): Promise<BarcodeMatch | null> {
  const byUpc = await lookupUpc(upc12);
  if (byUpc) return { ...byUpc, method: "upc" };
  // Tried in 4-4-2, 5-3-2, 5-4-1 order.
  for (const ndc of ndcCandidates(upc12)) {
    const hit = await lookupProductNdc(ndc);
    if (hit) return { ...hit, method: `ndc ${ndc}` };
  }
  return null;
}

// openFDA first; if it misses (or is rate-limited) on a US drug UPC, fall back to RxNorm's NDC index.
export async function resolveBarcode(upc12: string): Promise<BarcodeMatch | null> {
  let rateLimited: OpenFdaRateLimitError | null = null;
  try {
    const hit = await resolveWithOpenFda(upc12);
    if (hit) return hit;
  } catch (e) {
    if (!(e instanceof OpenFdaRateLimitError)) throw e;
    rateLimited = e;
  }
  if (upc12.startsWith("3")) {
    const rx = await ndcToIngredient(packageNdcCandidates(upc12));
    if (rx) return { ingredient: rx.ingredient, genericName: rx.ingredient, method: rx.method };
  }
  if (rateLimited) throw rateLimited;
  return null;
}
