// src/logic/sharedTargets.ts — find medicines in the cabinet that act on the same protein.
// Informational only; never gated behind a purchase.
import type { CabinetItem, HeroList } from "../types";
import { withGene } from "./resolveMedicine";

export type SharedTarget = {
  uniprotId: string;
  shortName: string;
  gene: string;
  medicines: string[]; // medicine names, in cabinet order
  note?: string;
};

const COX1 = "P23219";
const IBUPROFEN_ASPIRIN_NOTE =
  "FDA advises taking ibuprofen at least 30 minutes after, or 8 hours before, immediate-release low-dose aspirin, so the aspirin can do its job.";

export function findSharedTargets(items: CabinetItem[], heroList: HeroList): SharedTarget[] {
  const byId = new Map(heroList.medicines.map((m) => [m.id, m]));
  const groups = new Map<string, SharedTarget & { ids: string[] }>();

  for (const item of items) {
    const med = byId.get(item.medicineId);
    if (!med) continue;
    for (const link of med.targets) {
      const t = link.target;
      const g = groups.get(t.uniprotId) ?? { uniprotId: t.uniprotId, shortName: t.shortName, gene: t.gene, medicines: [], ids: [] };
      if (!g.ids.includes(med.id)) {
        g.ids.push(med.id);
        g.medicines.push(med.name);
      }
      groups.set(t.uniprotId, g);
    }
  }

  const shared = [...groups.values()].filter((g) => g.ids.length >= 2);

  // Ibuprofen + aspirin share COX-1 and COX-2; attach the FDA timing note once, to the COX-1
  // warning (aspirin's heart protection comes from blocking COX-1 in platelets).
  const pair = shared.filter((g) => g.ids.includes("ibuprofen") && g.ids.includes("aspirin"));
  const noteTarget = pair.find((g) => g.uniprotId === COX1) ?? pair[0];
  if (noteTarget) noteTarget.note = IBUPROFEN_ASPIRIN_NOTE;

  return shared.map(({ ids: _ids, ...g }) => g);
}

function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// The full warning sentence, shared by the cabinet banner and the exported sheet.
export function warningText(w: SharedTarget): string {
  const verb = w.medicines.length > 2 ? "all bind" : "both bind";
  const note = w.note ? ` ${w.note}` : "";
  return `${joinNames(w.medicines)} ${verb} ${withGene(w.shortName, w.gene)}.${note} Ask your pharmacist about timing.`;
}
