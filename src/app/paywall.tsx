// app/paywall.tsx — test screen tonight; becomes the real paywall later
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import { buy, getCustomerInfo, getPackages, restore } from "../lib/purchases";

export default function Paywall() {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [info, setInfo] = useState<CustomerInfo | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setPackages(await getPackages());
      setInfo(await getCustomerInfo());
    } catch (e: any) { setErr(String(e?.message ?? e)); }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() only sets state after awaiting RevenueCat
  useEffect(() => { load(); }, []);

  async function onBuy(pkg: PurchasesPackage) {
    try { setInfo(await buy(pkg)); }
    catch (e: any) { if (!e?.userCancelled) Alert.alert("Purchase failed", String(e?.message ?? e)); }
  }

  const active = Object.keys(info?.entitlements.active ?? {});

  return (
    <ScrollView style={s.page} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={s.h}>Lens Pro (test)</Text>
      <Text style={s.p}>Active entitlements: {active.length ? active.join(", ") : "none"}</Text>
      {err ? <Text style={[s.p, { color: "#ff8a8a" }]}>Error: {err}</Text> : null}
      {packages.length === 0 && !err && (
        <Text style={s.p}>No packages. Is the offering marked Current with 3 packages attached?</Text>
      )}
      {packages.map((pkg) => (
        <Pressable key={pkg.identifier} style={s.card} onPress={() => onBuy(pkg)}>
          <Text style={s.cardTitle}>{pkg.product.title}</Text>
          <Text style={s.p}>{pkg.product.identifier} · {pkg.product.priceString} · {pkg.packageType}</Text>
        </Pressable>
      ))}
      <Pressable style={[s.card, { backgroundColor: "#1c2440" }]} onPress={async () => setInfo(await restore())}>
        <Text style={s.cardTitle}>Restore purchases</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#05070f" },
  h: { color: "white", fontSize: 22, fontWeight: "700" },
  p: { color: "#c7cdea" },
  card: { backgroundColor: "#22306b", padding: 16, borderRadius: 14, gap: 4 },
  cardTitle: { color: "white", fontSize: 16, fontWeight: "600" },
});
