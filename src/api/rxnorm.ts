// src/api/rxnorm.ts — NDC → active ingredient via RxNorm (NLM RxNav, no key)
export type RxNormMatch = { ingredient: string; rxcui: string; method: string };

const BASE = "https://rxnav.nlm.nih.gov/REST";
const TIMEOUT_MS = 8000;
const MIN_GAP_MS = 100; // stay well under RxNav's 20 requests/second

let lastCall = 0;
async function getJson(url: string): Promise<any> {
  const wait = lastCall + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`RxNorm HTTP ${res.status}`);
    return await res.json();
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("RxNorm took too long to answer.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Candidates are hyphenated package NDCs (4-4-2, 5-3-2, 5-4-1); the first RxNorm hit wins.
export async function ndcToIngredient(ndcCandidates: string[]): Promise<RxNormMatch | null> {
  for (const candidate of ndcCandidates) {
    const ids = await getJson(`${BASE}/rxcui.json?idtype=NDC&id=${encodeURIComponent(candidate)}`);
    const rxcui: string | undefined = ids.idGroup?.rxnormId?.[0];
    if (!rxcui) continue;
    const related = await getJson(`${BASE}/rxcui/${rxcui}/related.json?tty=IN`);
    const groups: any[] = related.relatedGroup?.conceptGroup ?? [];
    const ingredient: string | undefined = groups.flatMap((g) => g.conceptProperties ?? [])[0]?.name;
    if (!ingredient) return null;
    return { ingredient, rxcui, method: `rxnorm ndc ${candidate}` };
  }
  return null;
}
