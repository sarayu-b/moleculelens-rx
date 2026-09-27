// src/components/LockedSection.tsx — shows children, or a locked teaser that opens the paywall
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = { title: string; locked: boolean; children: ReactNode; reason: string };

export default function LockedSection({ title, locked, children, reason }: Props) {
  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.title}>{title}</Text>
        {locked && <Text style={s.lock}>🔒</Text>}
      </View>
      {locked ? (
        <>
          <View style={s.bars} accessibilityLabel="Locked content">
            <View style={[s.bar, { width: "92%" }]} />
            <View style={[s.bar, { width: "78%" }]} />
            <View style={[s.bar, { width: "85%" }]} />
          </View>
          <Pressable style={s.btn} onPress={() => router.push({ pathname: "/paywall", params: { reason } })}>
            <Text style={s.btnText}>Unlock with Lens Pro</Text>
          </Pressable>
        </>
      ) : (
        children
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#111833", borderRadius: 14, padding: 14, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "white", fontSize: 16, fontWeight: "700" },
  lock: { fontSize: 16 },
  bars: { gap: 8, opacity: 0.6 },
  bar: { height: 12, borderRadius: 6, backgroundColor: "#2b3354" },
  btn: { backgroundColor: "#3b4fd1", paddingVertical: 11, borderRadius: 10, alignItems: "center" },
  btnText: { color: "white", fontWeight: "700" },
});
