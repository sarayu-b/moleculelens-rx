// src/app/medicine/[id].tsx — target screen: protein, 3D structure, plain-language cards
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import ExplanationCards from "../../components/ExplanationCards";
import MoleculeViewer from "../../components/MoleculeViewer";
import { getMedicine } from "../../logic/resolveMedicine";
import type { Medicine, Structure, TargetLink } from "../../types";

// Friendly names for animal source organisms in structure notes.
const COMMON_NAMES: Record<string, string> = { "Mus musculus": "mouse", "Rattus norvegicus": "rat", "Bos taurus": "cow" };

// Opening target: explicit primaryTarget, else first with a drug-bound (rcsb) structure, else the first.
function pickPrimary(med: Medicine): TargetLink | undefined {
  return (
    med.targets.find((l) => l.target.uniprotId === med.primaryTarget) ??
    med.targets.find((l) => l.structure?.source === "rcsb") ??
    med.targets[0]
  );
}

export default function MedicineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const med = getMedicine(String(id));
  const primary = med ? pickPrimary(med) : undefined;
  const [selectedId, setSelectedId] = useState(primary?.target.uniprotId);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const { height } = useWindowDimensions();

  if (!med) {
    return (
      <View style={s.page}>
        <Stack.Screen options={{ title: "Not found" }} />
        <Text style={[s.p, { padding: 16 }]}>That medicine isn’t in the MoleculeLens list yet.</Text>
      </View>
    );
  }

  const link = med.targets.find((l) => l.target.uniprotId === selectedId) ?? primary;
  const others = med.targets.filter((l) => l !== link);

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content} scrollEnabled={scrollEnabled}>
      <Stack.Screen options={{ title: med.name }} />

      <View>
        <Text style={s.h1}>{med.name}</Text>
        {med.brandNames.length > 0 && <Text style={s.brands}>{med.brandNames.join(" · ")}</Text>}
      </View>

      {med.mechanismDebated ? (
        <View style={s.debated}>
          <Text style={s.debatedTitle}>Mechanism still debated</Text>
          <Text style={s.p}>
            {med.cards
              ? `${med.cards.protein}\n\n${med.cards.drug}\n\n${med.cards.effect}`
              : "Scientists still debate exactly which protein this medicine acts on, so MoleculeLens doesn’t show one. Ask your pharmacist if you have questions."}
          </Text>
        </View>
      ) : !link ? (
        <Text style={s.p}>No verified protein target for this medicine yet.</Text>
      ) : (
        <>
          {med.targets.length > 1 && (
            <View style={s.chips}>
              {med.targets.map((l) => {
                const on = l === link;
                return (
                  <Pressable
                    key={l.target.uniprotId}
                    style={[s.chip, on && s.chipOn]}
                    onPress={() => setSelectedId(l.target.uniprotId)}
                  >
                    <Text style={[s.chipText, on && s.chipTextOn]}>{l.target.shortName}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={s.protein}>
            <Text style={s.h2}>{link.target.name}</Text>
            <Text style={s.p}>
              {link.target.shortName} · gene {link.target.gene}
            </Text>
            <Text style={s.mech}>
              {link.mechanism} · {link.actionType}
            </Text>
            {link.structure && <StructureNote st={link.structure} />}
          </View>

          {link.structure ? (
            // Pause page scrolling while a finger is on the 3D view so drags rotate the molecule.
            <View onTouchStart={() => setScrollEnabled(false)} onTouchEnd={() => setScrollEnabled(true)} onTouchCancel={() => setScrollEnabled(true)}>
              <MoleculeViewer
                key={link.target.uniprotId}
                fileUrl={link.structure.fileUrl}
                ligandCode={link.structure.ligandCode}
                chain={link.structure.chain}
                ligandLabel={link.structure.ligandLabel}
                height={Math.round(height * 0.55)}
              />
            </View>
          ) : (
            <Text style={s.p}>No 3D structure is available for this protein.</Text>
          )}

          <ExplanationCards medicine={med} link={primary} />

          {others.length > 0 && (
            <View style={s.others}>
              <Text style={s.h2}>Other targets</Text>
              {others.map((l) => (
                <Pressable key={l.target.uniprotId} style={s.otherRow} onPress={() => setSelectedId(l.target.uniprotId)}>
                  <Text style={s.otherTitle}>{l.target.shortName} — {l.target.name}</Text>
                  <Text style={s.small}>gene {l.target.gene} · {l.mechanism}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      {/* Wired up in Part D (cabinet). */}
      <Pressable style={[s.addBtn, s.addBtnDisabled]} disabled>
        <Text style={s.addText}>Add to cabinet</Text>
      </Pressable>

      <Text style={s.footer}>
        Educational only. Never change how you take a medicine without asking your pharmacist or doctor.
      </Text>
    </ScrollView>
  );
}

function StructureNote({ st }: { st: Structure }) {
  if (st.source === "alphafold") {
    return (
      <Text style={s.small}>
        Predicted structure (AlphaFold DB). No drug-bound experimental structure is bundled, so the drug itself isn’t shown.
      </Text>
    );
  }
  const common = COMMON_NAMES[st.organism];
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.small}>
        Structure {st.pdbId} · {st.organism}
        {st.resolutionA !== undefined ? ` · ${st.resolutionA} Å` : ""}
      </Text>
      {st.note && <Text style={s.small}>{st.note}</Text>}
      {st.isAnimal && (
        <Text style={s.amber}>
          This structure is from a {common ? `${common} (${st.organism})` : st.organism} protein, not human. The drug pocket is very similar.
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#05070f" },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  h1: { color: "white", fontSize: 26, fontWeight: "800" },
  brands: { color: "#9aa4c7", fontSize: 15, marginTop: 2 },
  h2: { color: "white", fontSize: 18, fontWeight: "700" },
  p: { color: "#c7cdea", fontSize: 15, lineHeight: 21 },
  small: { color: "#9aa4c7", fontSize: 13, lineHeight: 18 },
  mech: { color: "#9fb4ff", fontSize: 14 },
  protein: { gap: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#22306b", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  chipOn: { backgroundColor: "#22306b", borderColor: "#9fb4ff" },
  chipText: { color: "#9fb4ff", fontWeight: "600" },
  chipTextOn: { color: "white" },
  amber: {
    color: "#ffd166", fontSize: 13, lineHeight: 18, backgroundColor: "#2a2208",
    padding: 10, borderRadius: 10, overflow: "hidden",
  },
  debated: { backgroundColor: "#111833", borderRadius: 14, padding: 16, gap: 8, borderWidth: 1, borderColor: "#ffd16655" },
  debatedTitle: { color: "#ffd166", fontSize: 18, fontWeight: "700" },
  others: { gap: 8 },
  otherRow: { backgroundColor: "#111833", borderRadius: 12, padding: 12, gap: 2 },
  otherTitle: { color: "white", fontSize: 15, fontWeight: "600" },
  addBtn: { backgroundColor: "#3b4fd1", padding: 14, borderRadius: 12, alignItems: "center" },
  addBtnDisabled: { opacity: 0.4 },
  addText: { color: "white", fontWeight: "700", fontSize: 16 },
  footer: { color: "#6b7599", fontSize: 12, textAlign: "center", lineHeight: 17 },
});
