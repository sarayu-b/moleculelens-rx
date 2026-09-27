// src/app/paywall.tsx — Lens Pro + Study Pack paywall (our own UI; RevenueCat Test Store in Expo Go)
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { useEntitlements } from "../lib/EntitlementsProvider";
import { buy, getPackages, hasEntitlement, restore } from "../lib/purchases";

const HEADLINES: Record<string, string> = {
  cabinet: "Your free cabinet holds 3 medicines",
  study: "Study mode is part of Study Pack",
};
const BENEFITS = [
  "Unlimited family cabinet",
  "Side-effect and metabolism deep dives",
  "Exportable 'how my medicines work' sheet",
];

function trialText(pkg: PurchasesPackage): string {
  const intro = pkg.product.introPrice;
  if (intro) return `${intro.periodNumberOfUnits}-${intro.periodUnit.toLowerCase()} free trial, then`;
  return "7-day free trial, then";
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export default function Paywall() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const { isPro, hasStudy, refresh } = useEntitlements();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [selected, setSelected] = useState<"MONTHLY" | "ANNUAL">("ANNUAL");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const pkgs = await getPackages();
      setPackages(pkgs);
      setLoadState(pkgs.length ? "ready" : "error");
    } catch {
      setLoadState("error");
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of RevenueCat offerings
  useEffect(() => { load(); }, [load]);

  const monthly = packages.find((p) => p.packageType === "MONTHLY");
  const annual = packages.find((p) => p.packageType === "ANNUAL");
  const lifetime = packages.find((p) => p.packageType === "LIFETIME");
  const chosen = selected === "ANNUAL" ? annual ?? monthly : monthly ?? annual;

  async function purchase(pkg: PurchasesPackage | undefined, entitlement: "pro" | "study") {
    if (!pkg || busy) return;
    setBusy(true);
    try {
      const info = await buy(pkg); // purchasePackage + getCustomerInfo (listener never fires in Expo Go)
      await refresh();
      if (hasEntitlement(info, entitlement)) goBack();
    } catch (e: any) {
      if (!e?.userCancelled) Alert.alert("Purchase failed", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    if (busy) return;
    setBusy(true);
    try {
      const info = await restore();
      await refresh();
      const active = Object.keys(info.entitlements.active);
      Alert.alert("Restore purchases", active.length ? `Restored: ${active.join(", ")}` : "No previous purchases found.");
    } catch (e: any) {
      Alert.alert("Restore failed", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: "" }} />
      <Text style={s.h1}>{HEADLINES[reason ?? ""] ?? "See how all your medicines work"}</Text>

      {loadState === "loading" && <ActivityIndicator color="#fff" style={{ marginVertical: 24 }} />}

      {loadState === "error" && (
        <View style={s.errorBox}>
          <Text style={s.p}>{"Couldn't load plans. Check your connection and try again."}</Text>
          <Pressable style={s.secondaryBtn} onPress={load}>
            <Text style={s.secondaryText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {loadState === "ready" && (
        <>
          <View style={s.section}>
            <Text style={s.h2}>Lens Pro</Text>
            {BENEFITS.map((b) => (
              <View key={b} style={s.benefit}>
                <Text style={s.check}>✓</Text>
                <Text style={s.p}>{b}</Text>
              </View>
            ))}
            <Text style={s.free}>Safety warnings are always free.</Text>

            {isPro ? (
              <Text style={s.owned}>Lens Pro is active ✓</Text>
            ) : (
              <>
                <View style={s.plans}>
                  {[annual, monthly].filter(Boolean).map((pkg) => {
                    const p = pkg!;
                    const isAnnual = p.packageType === "ANNUAL";
                    const on = chosen?.identifier === p.identifier;
                    return (
                      <Pressable
                        key={p.identifier}
                        style={[s.plan, on && s.planOn]}
                        onPress={() => setSelected(isAnnual ? "ANNUAL" : "MONTHLY")}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                      >
                        <View style={s.planHead}>
                          <Text style={s.planTitle}>{isAnnual ? "Annual" : "Monthly"}</Text>
                          {isAnnual && <Text style={s.badge}>Best value</Text>}
                        </View>
                        <Text style={s.small}>{trialText(p)}</Text>
                        <Text style={s.price}>
                          {p.product.priceString} / {isAnnual ? "year" : "month"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable style={[s.primaryBtn, busy && s.busy]} disabled={busy || !chosen} onPress={() => purchase(chosen, "pro")}>
                  <Text style={s.primaryText}>{busy ? "Working…" : "Start free trial"}</Text>
                </Pressable>
              </>
            )}
          </View>

          {lifetime && (
            <View style={s.section}>
              <Text style={s.h2}>Study Pack</Text>
              <Text style={s.p}>Flashcards and quizzes built from your cabinet · {lifetime.product.priceString} once</Text>
              {hasStudy ? (
                <Text style={s.owned}>Study Pack owned ✓</Text>
              ) : (
                <Pressable style={[s.secondaryBtn, busy && s.busy]} disabled={busy} onPress={() => purchase(lifetime, "study")}>
                  <Text style={s.secondaryText}>Get Study Pack</Text>
                </Pressable>
              )}
            </View>
          )}
        </>
      )}

      <View style={s.textBtns}>
        <Pressable onPress={onRestore} hitSlop={8}>
          <Text style={s.link}>Restore purchases</Text>
        </Pressable>
        <Pressable onPress={goBack} hitSlop={8}>
          <Text style={s.link}>Not now</Text>
        </Pressable>
      </View>

      <Text style={s.footer}>Educational only · not medical advice · cancel anytime</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#05070f" },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  h1: { color: "white", fontSize: 26, fontWeight: "800", lineHeight: 32 },
  h2: { color: "white", fontSize: 20, fontWeight: "700" },
  p: { color: "#c7cdea", fontSize: 15, lineHeight: 21, flexShrink: 1 },
  small: { color: "#9aa4c7", fontSize: 13 },
  section: { backgroundColor: "#0d1330", borderRadius: 16, padding: 16, gap: 10 },
  benefit: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  check: { color: "#7ee2a8", fontSize: 16, fontWeight: "800", lineHeight: 21 },
  free: { color: "#ffd166", fontSize: 14, fontWeight: "600" },
  plans: { flexDirection: "row", gap: 10, marginTop: 4 },
  plan: { flex: 1, borderWidth: 2, borderColor: "#22306b", borderRadius: 14, padding: 12, gap: 4 },
  planOn: { borderColor: "#9fb4ff", backgroundColor: "#16204a" },
  planHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  planTitle: { color: "white", fontSize: 16, fontWeight: "700" },
  badge: {
    color: "#05070f", backgroundColor: "#ffd166", fontSize: 11, fontWeight: "800",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden",
  },
  price: { color: "white", fontSize: 16, fontWeight: "600" },
  primaryBtn: { backgroundColor: "#3b4fd1", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 4 },
  primaryText: { color: "white", fontSize: 18, fontWeight: "800" },
  secondaryBtn: { backgroundColor: "#22306b", paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  secondaryText: { color: "white", fontSize: 16, fontWeight: "700" },
  busy: { opacity: 0.6 },
  owned: { color: "#7ee2a8", fontSize: 16, fontWeight: "700" },
  errorBox: { gap: 12, backgroundColor: "#0d1330", borderRadius: 14, padding: 16 },
  textBtns: { flexDirection: "row", justifyContent: "space-around" },
  link: { color: "#9fb4ff", fontSize: 15, padding: 6 },
  footer: { color: "#6b7599", fontSize: 12, textAlign: "center" },
});
