// src/lib/storage.ts — the medicine cabinet, saved on the device
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CabinetItem } from "../types";

const CABINET_KEY = "cabinet:v1";

export async function getCabinet(): Promise<CabinetItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CABINET_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

async function saveCabinet(items: CabinetItem[]) {
  await AsyncStorage.setItem(CABINET_KEY, JSON.stringify(items));
}

export async function addToCabinet(medicineId: string): Promise<CabinetItem[]> {
  const items = await getCabinet();
  if (items.some((i) => i.medicineId === medicineId)) return items;
  const next = [...items, { medicineId, addedAt: new Date().toISOString() }];
  await saveCabinet(next);
  return next;
}

export async function removeFromCabinet(medicineId: string): Promise<CabinetItem[]> {
  const next = (await getCabinet()).filter((i) => i.medicineId !== medicineId);
  await saveCabinet(next);
  return next;
}
