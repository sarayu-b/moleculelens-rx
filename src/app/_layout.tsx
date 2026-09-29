// app/_layout.tsx
import { type ErrorBoundaryProps, Stack } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useEffect } from "react";
import { EntitlementsProvider } from "../lib/EntitlementsProvider";
import { initPurchases } from "../lib/purchases";

// Any render error below shows this instead of a blank or red screen.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  console.warn("[error boundary]", error);
  return (
    <View style={{ flex: 1, backgroundColor: "#05070f", alignItems: "center", justifyContent: "center", padding: 24, gap: 14 }}>
      <Text style={{ color: "white", fontSize: 20, fontWeight: "700" }}>Something went wrong</Text>
      <Text style={{ color: "#9aa4c7", fontSize: 15, textAlign: "center" }}>
        MoleculeLens hit an unexpected problem. Try again, or go back and pick another medicine.
      </Text>
      <Pressable onPress={retry} style={{ backgroundColor: "#3b4fd1", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 }}>
        <Text style={{ color: "white", fontWeight: "700" }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => { initPurchases(); }, []);
  return (
    <EntitlementsProvider>
      <Stack screenOptions={{ headerStyle: { backgroundColor: "#05070f" }, headerTintColor: "white" }} />
    </EntitlementsProvider>
  );
}
