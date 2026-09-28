// src/app/medicine/[id].tsx — target screen: protein, 3D structure, plain-language cards
import { Href, router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { fetchCards, fetchDeepDives } from "../../api/explain";
import ExplanationCards, { placeholderDeepDives } from "../../components/ExplanationCards";
import LockedSection from "../../components/LockedSection";
import MoleculeViewer from "../../components/MoleculeViewer";
import { cabinetAddNeedsPro } from "../../lib/entitlements";
import { useEntitlements } from "../../lib/EntitlementsProvider";
import { addToCabinet, getCabinet } from "../../lib/storage";
import { getMedicine, pickPrimary } from "../../logic/resolveMedicine";
import type { Cards, DeepDives, Structure } from "../../types";

// Friendly names for animal source organisms in structure notes.
const COMMON_NAMES: Record<string, string> = { "Mus musculus": "mouse", "Rattus norvegicus": "rat", "Bos taurus": "cow" };

const HAND_CAPTION = "Hand-verified explanation";
const AI_CAPTION = "AI explanation from verified facts · Gemini 3.8 Flash";
const FACTS_CAPTION = "Built from verified facts (ChEMBL · UniProt)";

// Hand-written text if the hero list has it; otherwise ask the Worker (null = not deployed or failed).
type Explained<T> = { status: "loading" } | { status: "done"; value: T | null; caption: string };

function useExplained<T>(hand: T | undefined, enabled: boolean, key: string, load: () => Promise<T | null>): Explained<T> {
  const [fetched, setFetched] = useState<{ key: string; value: T | null } | null>(null);
  useEffect(() => {
    if (hand || !enabled) return;
    let active = true;
    load().then((value) => { if (active) setFetched({ key, value }); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand, enabled, key]);
  if (hand) return { status: "done", value: hand, caption: HAND_CAPTION };
  if (!enabled || fetched?.key !== key) return { status: "loading" };
  return { status: "done", value: fetched.value, caption: fetched.value ? AI_CAPTION : FACTS_CAPTION };
}

export default function MedicineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const med = getMedicine(String(id));
  const primary = med ? pickPrimary(med) : undefined;
  const [selectedId, setSelectedId] = useState(primary?.target.uniprotId);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const { height } = useWindowDimensions();
  const [inCabinet, setInCabinet] = useState(false);
  const [busy, setBusy] = useState(false);
  const { isPro } = useEntitlements();

  // Never ask the AI about medicines whose mechanism is debated.
  const canAsk = !!med && !!primary && !med.mechanismDebated;
  const askKey = `${med?.id}:${primary?.target.uniprotId}`;
  const cards = useExplained<Cards>(med?.cards, canAsk, askKey, () => fetchCards(med!, primary!));
  const dives = useExplained<DeepDives>(med?.deepDives, canAsk && isPro, askKey, () => fetchDeepDives(med!, primary!));

  // Re-check on every visit (e.g. after removing it in the cabinet or buying Lens Pro).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getCabinet().then((cab) => { if (active) setInCabinet(cab.some((i) => i.medicineId === String(id))); });
      return () => { active = false; };
    }, [id])
  );

  async function onAddToCabinet() {
    if (!med || busy) return;
    if (inCabinet) { router.push("/cabinet" as Href); return; }
    setBusy(true);
    try {
      const cab = await getCabinet();
      if (cabinetAddNeedsPro(cab.length, isPro)) {
        router.push({ pathname: "/paywall", params: { reason: "cabinet" } });
        return;
      }
      await addToCabinet(med.id);
      setInCabinet(true);
    } finally {
      setBusy(false);
    }
  }

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
  const comingSoon = "A deeper look for this medicine is coming soon.";
  // Debated medicines never call the Worker, so they only ever show hand-written deep dives.
  const diveLoading = canAsk && !med.deepDives && dives.status === "loading";
  const diveValue = med.deepDives ?? (dives.status === "done" ? (dives.value ?? (primary ? placeholderDeepDives(med, primary) : null)) : null);
  const diveCaption = med.deepDives ? HAND_CAPTION : canAsk && dives.status === "done" ? dives.caption : undefined;
  const diveBody = (text?: string) =>
    diveLoading ? (
      <View style={s.bars} accessibilityLabel="Loading deep dive">
        <View style={[s.bar, { width: "94%" }]} />
        <View style={[s.bar, { width: "86%" }]} />
        <View style={[s.bar, { width: "70%" }]} />
      </View>
    ) : (
      <>
        <Text style={s.p}>{text ?? comingSoon}</Text>
        {diveCaption && <Text style={s.caption}>{diveCaption}</Text>}
      </>
    );
  const deepDives = (
    <>
      <LockedSection title="Side-effect deep dive" locked={!isPro} reason="deepdive">
        {diveBody(diveValue?.sideEffects)}
      </LockedSection>
      <LockedSection title="Metabolism deep dive" locked={!isPro} reason="deepdive">
        {diveBody(diveValue?.metabolism)}
      </LockedSection>
    </>
  );

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content} scrollEnabled={scrollEnabled}>
      <Stack.Screen options={{ title: med.name }} />

      <View>
        <Text style={s.h1}>{med.name}</Text>
        {med.brandNames.length > 0 && <Text style={s.brands}>{med.brandNames.join(" · ")}</Text>}
      </View>

      {med.mechanismDebated ? (
        <>
          <View style={s.debated}>
            <Text style={s.debatedTitle}>Mechanism still debated</Text>
            <Text style={s.p}>
              {med.cards
                ? `${med.cards.protein}\n\n${med.cards.drug}\n\n${med.cards.effect}`
                : "Scientists still debate exactly which protein this medicine acts on, so MoleculeLens doesn’t show one. Ask your pharmacist if you have questions."}
            </Text>
          </View>
          {deepDives}
        </>
      ) : med.noProteinMechanism ? (
        <>
          <View style={s.debated}>
            <Text style={s.debatedTitle}>No protein target</Text>
            <Text style={s.p}>
              This ingredient works physically or chemically (for example coating, neutralising or lubricating) rather
              than by binding a protein, so there’s nothing to show in 3D.
            </Text>
          </View>
          {deepDives}
        </>
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
            {!isHuman(link.target.organism) && (
              <Text style={s.amber}>
                This protein belongs to {link.target.organism}, not to you — the medicine attacks the germ.
              </Text>
            )}
            {link.structure && <StructureNote st={link.structure} germ={!isHuman(link.target.organism)} />}
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

          <ExplanationCards
            medicine={med}
            link={primary}
            loading={cards.status === "loading"}
            cards={cards.status === "done" ? cards.value : null}
            caption={cards.status === "done" ? cards.caption : undefined}
          />
          {deepDives}

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

      <Pressable style={[s.addBtn, inCabinet && s.addBtnDone, busy && s.addBtnBusy]} onPress={onAddToCabinet} disabled={busy}>
        <Text style={s.addText}>{inCabinet ? "In your cabinet ✓" : "Add to cabinet"}</Text>
      </Pressable>
      {inCabinet && (
        <Pressable onPress={() => router.push("/cabinet" as Href)}>
          <Text style={s.cabinetLink}>View cabinet and shared-target warnings →</Text>
        </Pressable>
      )}

      <Text style={s.footer}>
        Educational only. Never change how you take a medicine without asking your pharmacist or doctor.
      </Text>
    </ScrollView>
  );
}

const isHuman = (organism: string) => !organism || organism.startsWith("Homo sapiens");

// germ: the target itself is non-human, so the "animal stand-in" note would be misleading.
function StructureNote({ st, germ }: { st: Structure; germ: boolean }) {
  if (st.source === "alphafold") {
    return (
      <Text style={s.small}>
        Predicted structure (AlphaFold DB{germ ? `, ${st.organism}` : ""}). No drug-bound experimental structure is
        bundled, so the drug itself isn’t shown.
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
      {st.isAnimal && !germ && (
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
  addBtnDone: { backgroundColor: "#1c6b4a" },
  addBtnBusy: { opacity: 0.6 },
  cabinetLink: { color: "#9fb4ff", textAlign: "center", fontSize: 15 },
  addText: { color: "white", fontWeight: "700", fontSize: 16 },
  bars: { gap: 8, opacity: 0.6 },
  bar: { height: 12, borderRadius: 6, backgroundColor: "#2b3354" },
  caption: { color: "#6b7599", fontSize: 12 },
  footer: { color: "#6b7599", fontSize: 12, textAlign: "center", lineHeight: 17 },
});
