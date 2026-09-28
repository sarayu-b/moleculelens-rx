// src/components/ExplanationCards.tsx — the three plain-language cards
import { StyleSheet, Text, View } from "react-native";
import { firstSentences } from "../logic/text";
import type { Cards, DeepDives, Medicine, TargetLink } from "../types";

const TITLES = [
  "What the protein normally does",
  "What the drug changes",
  "Why that helps — and can cause side effects",
];

export function placeholderCards(medicine: Medicine, link?: TargetLink): Cards {
  const t = link?.target;
  return {
    protein: t?.functionText ? firstSentences(t.functionText, 2) : "No protein description is available yet.",
    drug: link
      ? `${medicine.name} is a ${link.actionType.toLowerCase()} of ${t!.shortName} (${link.mechanism}).`
      : `${medicine.name}'s protein target isn't verified yet.`,
    effect: link
      ? `Both the benefit and many of the side effects come from this change to ${t!.shortName}. Ask your pharmacist if you have questions.`
      : "Ask your pharmacist if you have questions.",
  };
}

// Deep dives built only from the verified target facts (used when no hand-written or AI text exists).
export function placeholderDeepDives(medicine: Medicine, link: TargetLink): DeepDives {
  return {
    sideEffects: `Many of ${medicine.name}'s side effects come from the same action on ${link.target.shortName} (${link.mechanism}) that gives its benefit. Ask your pharmacist if you have questions.`,
    metabolism: `How the body absorbs, breaks down and clears ${medicine.name} isn't in MoleculeLens's verified data yet. Your pharmacist or the medicine's leaflet can tell you more.`,
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
