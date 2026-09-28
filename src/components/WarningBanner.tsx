// src/components/WarningBanner.tsx — amber shared-target warning (never paywalled)
import { StyleSheet, Text, View } from "react-native";
import { withGene } from "../logic/resolveMedicine";
import type { SharedTarget } from "../logic/sharedTargets";

function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function warningText(w: SharedTarget): string {
  const verb = w.medicines.length > 2 ? "all bind" : "both bind";
  const note = w.note ? ` ${w.note}` : "";
  return `${joinNames(w.medicines)} ${verb} ${withGene(w.shortName, w.gene)}.${note} Ask your pharmacist about timing.`;
}

export default function WarningBanner({ warning }: { warning: SharedTarget }) {
  return (
    <View style={s.banner} accessibilityRole="alert">
      <Text style={s.icon}>⚠︎</Text>
      <Text style={s.text}>{warningText(warning)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: "row", gap: 10, backgroundColor: "#2a2208", borderColor: "#ffd166",
    borderWidth: 1, borderRadius: 12, padding: 12,
  },
  icon: { color: "#ffd166", fontSize: 18, lineHeight: 21 },
  text: { flex: 1, color: "#ffe6a8", fontSize: 14, lineHeight: 20 },
});
