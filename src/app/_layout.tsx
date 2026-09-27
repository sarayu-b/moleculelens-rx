// app/_layout.tsx
import { Stack } from "expo-router";
import { useEffect } from "react";
import { EntitlementsProvider } from "../lib/EntitlementsProvider";
import { initPurchases } from "../lib/purchases";

export default function RootLayout() {
  useEffect(() => { initPurchases(); }, []);
  return (
    <EntitlementsProvider>
      <Stack screenOptions={{ headerStyle: { backgroundColor: "#05070f" }, headerTintColor: "white" }} />
    </EntitlementsProvider>
  );
}
