// src/logic/resolveMedicine.ts
// Looks up medicines in the bundled hero list (src/data/heroList.json).
import heroJson from "../data/heroList.json";
import type { HeroList, Medicine } from "../types";

const hero = heroJson as unknown as HeroList;
const byId = new Map(hero.medicines.map((m) => [m.id, m]));

export function getHeroList(): HeroList {
  return hero;
}

export function getMedicine(id: string): Medicine | undefined {
  return byId.get(id);
}

// Lower score = better match: exact, then prefix, then word prefix, then substring.
function matchScore(text: string, q: string): number {
  const t = text.toLowerCase();
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (t.split(/[\s-]+/).some((w) => w.startsWith(q))) return 2;
  if (t.includes(q)) return 3;
  return Infinity;
}

export function searchHero(query: string, limit = 8): Medicine[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return hero.medicines
    .map((m) => {
      const fields = [m.name, m.ingredient, ...m.brandNames];
      return { m, score: Math.min(...fields.map((f) => matchScore(f, q))) };
    })
    .filter((r) => r.score !== Infinity)
    .sort((a, b) => a.score - b.score || a.m.name.localeCompare(b.m.name))
    .slice(0, limit)
    .map((r) => r.m);
}

// One-line target summary for lists, e.g. "COX-2 · COX-1" or "Mechanism still debated".
export function targetSummary(m: Medicine, max = 3): string {
  if (m.mechanismDebated) return "Mechanism still debated";
  const names = [...new Set(m.targets.map((t) => t.target.shortName))];
  if (!names.length) return "No verified target yet";
  const shown = names.slice(0, max).join(" · ");
  return names.length > max ? `${shown} +${names.length - max}` : shown;
}
