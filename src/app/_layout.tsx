// app/_layout.tsx
import { Stack } from "expo-router";
import { useEffect } from "react";
import { initPurchases } from "../lib/purchases";

export default function RootLayout() {
  useEffect(() => { initPurchases(); }, []);
  return <Stack screenOptions={{ headerStyle: { backgroundColor: "#05070f" }, headerTintColor: "white" }} />;
}
