// src/logic/exportSheet.ts — Lens Pro "how my medicines work" sheet, as plain text for the share sheet
import type { CabinetItem, Medicine } from "../types";
import { getHeroList, getMedicine, pickPrimary, withGene } from "./resolveMedicine";
import { findSharedTargets, warningText } from "./sharedTargets";
import { firstSentences } from "./text";

export const SHEET_TITLE = "How my medicines work — MoleculeLens Rx (educational only, not medical advice)";

function medicineLines(m: Medicine): string[] {
  if (m.mechanismDebated) return [`• ${m.name} → mechanism still debated — no single protein`];
  if (m.noProteinMechanism) return [`• ${m.name} → no protein target — works physically or chemically`];
  const link = pickPrimary(m);
  if (!link) return [`• ${m.name} → no verified protein target yet`];
  const detail = m.cards?.drug ?? (link.target.functionText ? firstSentences(link.target.functionText, 1) : "");
  const lines = [`• ${m.name} → ${withGene(link.target.shortName, link.target.gene)} · ${link.mechanism}`];
  if (detail) lines.push(`  ${detail}`);
  return lines;
}

export function buildSheet(items: CabinetItem[], now = new Date()): string {
  const meds = items.map((i) => getMedicine(i.medicineId)).filter((m): m is Medicine => !!m);
  const warnings = findSharedTargets(items, getHeroList());
  const out = [SHEET_TITLE, ""];
  for (const m of meds) out.push(...medicineLines(m));
  out.push("", "Shared targets");
  if (warnings.length) out.push(...warnings.map((w) => `• ${warningText(w)}`));
  else out.push("• None of these medicines act on the same protein.");
  out.push("", `Ask your pharmacist about timing. Generated ${now.toLocaleDateString()}.`);
  return out.join("\n");
}
