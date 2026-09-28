// src/components/ExplanationCards.tsx — the three plain-language cards
import { StyleSheet, Text, View } from "react-native";
import type { Cards, Medicine, TargetLink } from "../types";

const TITLES = [
  "What the protein normally does",
  "What the drug changes",
  "Why that helps — and can cause side effects",
];

function firstSentences(text: string, n: number): string {
  // UniProt text carries evidence tags like "(PubMed:12345)" — drop them for readability.
  const clean = text.replace(/\s*\((?:PubMed|ECO)[^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const parts = clean.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [clean];
  return parts.slice(0, n).join("").trim();
}

export function placeholderCards(medicine: Medicine, link?: TargetLink): Cards {
  const t = link?.target;
  return {
    protein: t?.functionText ? firstSentences(t.functionText, 2) : "No protein description is available yet.",
    drug: link
      ? `${medicine.name} is a ${link.actionType.toLowerCase()} of ${t!.shortName} (${link.mechanism}).`
      : `${medicine.name}'s protein target isn't verified yet.`,
    effect: "A plain-language explanation isn't available right now. Ask your pharmacist if you have questions.",
  };
}

type Props = { medicine: Medicine; link?: TargetLink; cards?: Cards | null; caption?: string; loading?: boolean };

export default function ExplanationCards({ medicine, link, cards, caption, loading }: Props) {
  const shown = cards ?? placeholderCards(medicine, link);
  const bodies = [shown.protein, shown.drug, shown.effect];
  return (
    <View style={s.wrap}>
      {TITLES.map((title, i) => (
        <View key={title} style={s.card}>
          <Text style={s.title}>{title}</Text>
          {loading ? (
            <View style={s.bars} accessibilityLabel="Loading explanation">
              <View style={[s.bar, { width: "94%" }]} />
              <View style={[s.bar, { width: "80%" }]} />
            </View>
          ) : (
            <Text style={s.body}>{bodies[i]}</Text>
          )}
        </View>
      ))}
      {!loading && caption && <Text style={s.caption}>{caption}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  card: { backgroundColor: "#111833", borderRadius: 14, padding: 14, gap: 6 },
  title: { color: "white", fontSize: 16, fontWeight: "700" },
  body: { color: "#c7cdea", fontSize: 15, lineHeight: 21 },
  bars: { gap: 8, opacity: 0.6, paddingVertical: 4 },
  bar: { height: 12, borderRadius: 6, backgroundColor: "#2b3354" },
  caption: { color: "#6b7599", fontSize: 12, textAlign: "center" },
});
