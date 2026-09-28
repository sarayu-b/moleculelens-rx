// src/logic/text.ts — small text helpers shared by screens and study mode

// First n sentences of a UniProt text, without its evidence tags like "(PubMed:12345)".
export function firstSentences(text: string, n: number): string {
  const clean = text.replace(/\s*\((?:PubMed|ECO)[^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const parts = clean.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [clean];
  return parts.slice(0, n).join("").trim();
}
