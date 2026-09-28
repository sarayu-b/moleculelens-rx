// src/logic/resolveMedicine.ts
// Looks up medicines in the bundled hero list (src/data/heroList.json).
import heroJson from "../data/heroList.json";
import type { HeroList, Medicine, TargetLink } from "../types";

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

// Match an openFDA ingredient/generic name to a hero medicine, case-insensitively.
// Exact match on ingredient or name first; then a salt form like "CETIRIZINE HYDROCHLORIDE".
export function findByIngredient(name: string): Medicine | undefined {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  const fields = (m: Medicine) => [m.ingredient.toLowerCase(), m.name.toLowerCase()];
  return (
    hero.medicines.find((m) => fields(m).includes(q)) ??
    hero.medicines.find((m) => fields(m).some((f) => q.startsWith(f + " ")))
  );
}

// One-line target summary for lists, e.g. "COX-2 · COX-1" or "Mechanism still debated".
export function targetSummary(m: Medicine, max = 3): string {
  if (m.mechanismDebated) return "Mechanism still debated";
  if (m.noProteinMechanism) return "Works without a protein target";
  const names = [...new Set(m.targets.map((t) => t.target.shortName))];
  if (!names.length) return "No verified target yet";
  const shown = names.slice(0, max).join(" · ");
  return names.length > max ? `${shown} +${names.length - max}` : shown;
}

// Multi-part machines (the bacterial ribosome) are one pseudo-target keyed by a ChEMBL target id.
export const isMachineTarget = (link: TargetLink) => link.target.uniprotId.startsWith("CHEMBL");

const isHumanTarget = (link: TargetLink) => link.target.organism.startsWith("Homo sapiens");

// Opening target: explicit primaryTarget; else, when human and non-human targets are mixed, the first
// in ChEMBL's mechanism order (authoritative); else the first with a drug-bound (rcsb) structure; else the first.
export function pickPrimary(med: Medicine): TargetLink | undefined {
  const explicit = med.targets.find((l) => l.target.uniprotId === med.primaryTarget);
  if (explicit) return explicit;
  const mixed = med.targets.some(isHumanTarget) && med.targets.some((l) => !isHumanTarget(l));
  if (mixed) return med.targets[0];
  return med.targets.find((l) => l.structure?.source === "rcsb") ?? med.targets[0];
}

// "COX-2 (PTGS2)", or just "Ribosome" when there is no gene symbol.
export const withGene = (shortName: string, gene: string) => (gene ? `${shortName} (${gene})` : shortName);
