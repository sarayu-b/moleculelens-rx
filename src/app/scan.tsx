// src/app/scan.tsx — scan a medicine box barcode → openFDA → hero medicine
import { BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import { Href, router, Stack } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { OpenFdaRateLimitError, resolveBarcode } from "../api/openfda";
import { isProductBarcode, normalizeType, normalizeUpc } from "../logic/barcode";
import { findByIngredient } from "../logic/resolveMedicine";

type Result =
  | { kind: "idle" }
  | { kind: "looking"; code: string }
  | { kind: "notListed"; brandName: string; ingredient: string }
  | { kind: "notFound"; upc?: string }
  | { kind: "notProduct" }
  | { kind: "error"; message: string };

const REPEAT_MS = 2000;

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const [manual, setManual] = useState("");
  const busy = useRef(false);
  const last = useRef({ code: "", at: 0 });
  // DIAGNOSTICS (temporary — keep until the user says remove): last raw read + lookup outcome.
  const [diag, setDiag] = useState("");
  const report = (read: string, outcome: string) => {
    const line = `${read} → ${outcome}`;
    setDiag(line);
    console.log("[scan]", line);
  };

  async function lookup(raw: string, type: string) {
    const read = `Read: ${type} ${raw}`;
    if (!isProductBarcode(type)) {
      report(read, "not a product barcode");
      setResult({ kind: "notProduct" });
      return;
    }
    const upc = normalizeUpc(raw, type);
    if (!upc) {
      report(read, `can't convert ${normalizeType(type)} to UPC-A → not found`);
      setResult({ kind: "notFound" });
      return;
    }
    const readUpc = upc === raw ? read : `${read} (UPC-A ${upc})`;
    busy.current = true;
    setResult({ kind: "looking", code: upc });
    try {
      const hit = await resolveBarcode(upc);
      if (!hit) { report(readUpc, "not found"); setResult({ kind: "notFound", upc }); return; }
      const med = findByIngredient(hit.ingredient ?? "") ?? findByIngredient(hit.genericName ?? "");
      report(readUpc, `matched ${hit.method} · ${hit.brandName ?? "?"} / ${hit.ingredient ?? hit.genericName ?? "?"} → ${med ? med.id : "not in list"}`);
      if (med) { router.replace(`/medicine/${med.id}` as Href); return; }
      setResult({
        kind: "notListed",
        brandName: hit.brandName ?? "this product",
        ingredient: (hit.ingredient ?? hit.genericName ?? "unknown ingredient").toLowerCase(),
      });
    } catch (e: any) {
      report(readUpc, e instanceof OpenFdaRateLimitError ? "openfda 429" : `error: ${e?.message ?? e}`);
      setResult({
        kind: "error",
        message: e instanceof OpenFdaRateLimitError ? e.message : `Lookup failed: ${e?.message ?? e}`,
      });
    } finally {
      busy.current = false;
    }
  }

  function onBarcodeScanned({ data, type }: BarcodeScanningResult) {
    const now = Date.now();
    // Ignore scans while a lookup runs, within 2 s of the last scan, and the same code twice in a row.
    if (busy.current || now - last.current.at < REPEAT_MS || data === last.current.code) return;
    last.current = { code: data, at: now };
    lookup(data, type);
  }

  function onManualGo() {
    const digits = manual.replace(/\D/g, "");
    if (digits.length !== 12) { setResult({ kind: "error", message: "Enter all 12 digits of the UPC." }); return; }
    last.current = { code: digits, at: Date.now() };
    lookup(digits, "upc_a");
  }

  const searchInstead = () => router.navigate("/");

  return (
    <KeyboardAvoidingView style={s.page} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: "Scan a box" }} />

      <View style={s.cameraWrap}>
        {!permission ? (
          <ActivityIndicator color="#fff" style={{ flex: 1 }} />
        ) : !permission.granted ? (
          <View style={s.permission}>
            <Text style={s.h2}>Camera access</Text>
            <Text style={s.p}>
              MoleculeLens uses the camera only to read the barcode on a medicine box. Nothing is recorded or uploaded.
            </Text>
            <Pressable style={s.btn} onPress={requestPermission}>
              <Text style={s.btnText}>Allow camera</Text>
            </Pressable>
            {!permission.canAskAgain && (
              <Text style={s.small}>Camera access is off. Turn it on for Expo Go in the iPhone Settings app.</Text>
            )}
          </View>
        ) : (
          <>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              autofocus="on"
              barcodeScannerSettings={{ barcodeTypes: ["upc_a", "upc_e", "ean13", "ean8", "code128", "qr"] }}
              onBarcodeScanned={onBarcodeScanned}
            />
            <View style={s.overlay} pointerEvents="none">
              <View style={s.frame} />
              <Text style={s.overlayText}>Point at the barcode on the box</Text>
              <Text style={s.overlayHint}>Hold the box 15–25 cm away and keep it still</Text>
            </View>
          </>
        )}
      </View>

      <View style={s.panel}>
        {result.kind === "looking" && (
          <View style={s.row}>
            <ActivityIndicator color="#fff" />
            <Text style={s.p}>Looking up {result.code}…</Text>
          </View>
        )}
        {result.kind === "notListed" && (
          <View style={s.card}>
            <Text style={s.p}>
              Found {result.brandName} — {result.ingredient}. Not in the MoleculeLens list yet.
            </Text>
            <Pressable style={s.btn} onPress={searchInstead}>
              <Text style={s.btnText}>Search instead</Text>
            </Pressable>
          </View>
        )}
        {result.kind === "notFound" && (
          <View style={s.card}>
            <Text style={s.p}>
              {result.upc && !result.upc.startsWith("3")
                ? "That barcode isn't a US medicine barcode — medicine UPCs start with 3. Vitamins and supplements aren't covered."
                : "Couldn't read that box. Try the search."}
            </Text>
            <Pressable style={s.btn} onPress={searchInstead}>
              <Text style={s.btnText}>Search instead</Text>
            </Pressable>
          </View>
        )}
        {result.kind === "notProduct" && (
          <View style={s.card}>
            <Text style={s.p}>{"That's not a product barcode. Look for the UPC barcode (the one with 12 numbers under it)."}</Text>
          </View>
        )}
        {result.kind === "error" && <Text style={s.error}>{result.message}</Text>}

        <Text style={s.small}>Enter barcode manually</Text>
        <View style={s.row}>
          <TextInput
            style={s.input}
            value={manual}
            onChangeText={(t) => setManual(t.replace(/\D/g, "").slice(0, 12))}
            placeholder="12-digit UPC"
            placeholderTextColor="#6b7599"
            keyboardType="number-pad"
            maxLength={12}
            returnKeyType="go"
            onSubmitEditing={onManualGo}
          />
          <Pressable style={[s.btn, s.goBtn]} onPress={onManualGo}>
            <Text style={s.btnText}>Go</Text>
          </Pressable>
        </View>
        {diag ? <Text style={s.diag} selectable>{diag}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#05070f" },
  cameraWrap: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  overlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: "rgba(0,0,0,0.25)" },
  frame: { width: "80%", height: 150, borderWidth: 3, borderColor: "#9fb4ff", borderRadius: 16, backgroundColor: "transparent" },
  overlayText: { color: "white", fontSize: 16, fontWeight: "600", textShadowColor: "black", textShadowRadius: 4 },
  overlayHint: { color: "#dfe5ff", fontSize: 14, textShadowColor: "black", textShadowRadius: 4, marginTop: -8 },
  permission: { flex: 1, justifyContent: "center", padding: 24, gap: 14, backgroundColor: "#05070f" },
  panel: { padding: 16, gap: 10, backgroundColor: "#05070f" },
  card: { backgroundColor: "#111833", borderRadius: 12, padding: 14, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  h2: { color: "white", fontSize: 20, fontWeight: "700" },
  p: { color: "#c7cdea", fontSize: 15, lineHeight: 21, flexShrink: 1 },
  small: { color: "#9aa4c7", fontSize: 13 },
  error: { color: "#ff8a8a", fontSize: 14, lineHeight: 20 },
  input: {
    flex: 1, backgroundColor: "#111833", color: "white", fontSize: 18, letterSpacing: 1,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#22306b",
  },
  btn: { backgroundColor: "#3b4fd1", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: "center" },
  goBtn: { paddingHorizontal: 22 },
  diag: { color: "#6b7599", fontSize: 11, fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }) },
  btnText: { color: "white", fontWeight: "700", fontSize: 16 },
});
