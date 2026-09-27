// src/app/cabinet.tsx — saved medicines + shared-target warnings
import { Href, router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import WarningBanner from "../components/WarningBanner";
import { cabinetAddNeedsPro, FREE_CABINET_LIMIT, isPro } from "../lib/entitlements";
import { getCabinet, removeFromCabinet } from "../lib/storage";
import { getHeroList, getMedicine, targetSummary } from "../logic/resolveMedicine";
import { findSharedTargets } from "../logic/sharedTargets";
import type { CabinetItem } from "../types";

export default function Cabinet() {
  const [items, setItems] = useState<CabinetItem[]>([]);
  const [pro, setPro] = useState(false);

  // Re-read on every visit (after adding on a target screen or buying on the paywall).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [cab, p] = await Promise.all([getCabinet(), isPro()]);
        if (active) { setItems(cab); setPro(p); }
      })();
      return () => { active = false; };
    }, [])
  );

  const warnings = findSharedTargets(items, getHeroList());

  async function onAdd() {
    if (await cabinetAddNeedsPro(items.length)) router.push("/paywall");
    else router.navigate("/"); // search on Home, then "Add to cabinet" on the target screen
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: "My cabinet" }} />

      {warnings.length > 0 && (
        <View style={s.block}>
          <Text style={s.h2}>Shared targets</Text>
          {warnings.map((w) => <WarningBanner key={w.uniprotId} warning={w} />)}
        </View>
      )}

      {items.length === 0 ? (
        <Text style={s.empty}>Add medicines to check for shared targets.</Text>
      ) : (
        <View style={s.block}>
          <Text style={s.h2}>Your medicines</Text>
          {items.map((item) => {
            const med = getMedicine(item.medicineId);
            if (!med) return null;
            const remove = async () => setItems(await removeFromCabinet(med.id));
            return (
              <Pressable
                key={med.id}
                style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
                onPress={() => router.push(`/medicine/${med.id}` as Href)}
                onLongPress={remove}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{med.name}</Text>
                  <Text style={s.rowSub}>{targetSummary(med)}</Text>
                </View>
                <Pressable onPress={remove} hitSlop={12} accessibilityLabel={`Remove ${med.name}`} style={s.remove}>
                  <Text style={s.removeText}>✕</Text>
                </Pressable>
              </Pressable>
            );
          })}
          <Text style={s.hint}>Tap to open · long-press or ✕ to remove</Text>
        </View>
      )}

      <Pressable style={s.addBtn} onPress={onAdd}>
        <Text style={s.addText}>+ Add a medicine</Text>
      </Pressable>
      <Text style={s.plan}>
        {pro ? "Lens Pro: unlimited medicines" : `Free plan: ${FREE_CABINET_LIMIT} medicines · Lens Pro: unlimited`}
      </Text>

      <Text style={s.footer}>
        Educational only. Never change how you take a medicine without asking your pharmacist or doctor.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#05070f" },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  block: { gap: 10 },
  h2: { color: "white", fontSize: 18, fontWeight: "700" },
  empty: { color: "#9aa4c7", fontSize: 16, textAlign: "center", paddingVertical: 32 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#111833", borderRadius: 12, padding: 14, gap: 10 },
  rowTitle: { color: "white", fontSize: 17, fontWeight: "600" },
  rowSub: { color: "#9fb4ff", fontSize: 13, marginTop: 2 },
  remove: { padding: 6 },
  removeText: { color: "#9aa4c7", fontSize: 18 },
  hint: { color: "#6b7599", fontSize: 12, textAlign: "center" },
  addBtn: { backgroundColor: "#3b4fd1", padding: 14, borderRadius: 12, alignItems: "center" },
  addText: { color: "white", fontWeight: "700", fontSize: 16 },
  plan: { color: "#9aa4c7", fontSize: 13, textAlign: "center" },
  footer: { color: "#6b7599", fontSize: 12, textAlign: "center", lineHeight: 17 },
});
