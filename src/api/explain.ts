// src/api/explain.ts — AI explanations from verified facts via our Cloudflare Worker (worker/)
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Cards, DeepDives, Medicine, TargetLink } from "../types";

// EXPO_PUBLIC_ values are inlined into the bundle: the token only deters casual abuse of the Worker.
const WORKER_URL = process.env.EXPO_PUBLIC_WORKER_URL;
const APP_TOKEN = process.env.EXPO_PUBLIC_APP_TOKEN;
const TIMEOUT_MS = 12000;

function facts(med: Medicine, link: TargetLink) {
  const st = link.structure;
  const structureNote = st
    ? [st.note, st.isAnimal ? `The 3D structure shown is from ${st.organism}, not human.` : undefined]
        .filter(Boolean)
        .join(" ") || undefined
    : undefined;
  return {
    drug: med.name,
    protein: link.target.name,
    shortName: link.target.shortName,
    gene: link.target.gene,
    uniprotId: link.target.uniprotId,
    functionText: link.target.functionText,
    mechanism: link.mechanism,
    actionType: link.actionType,
    structureNote,
  };
}

async function post<T extends Record<string, string>>(
  path: string, cacheKey: string, keys: (keyof T)[], med: Medicine, link: TargetLink
): Promise<T | null> {
  if (!WORKER_URL) return null;
  const isValid = (v: any): v is T => !!v && keys.every((k) => typeof v[k] === "string" && v[k]);
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (isValid(parsed)) return parsed;
    }
  } catch {}

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${WORKER_URL.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-app-token": APP_TOKEN ?? "" },
      body: JSON.stringify(facts(med, link)),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!isValid(data)) return null;
    AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => {});
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function fetchCards(med: Medicine, link: TargetLink): Promise<Cards | null> {
  return post<Cards>("/explain", `explain:v1:${med.id}:${link.target.uniprotId}`, ["protein", "drug", "effect"], med, link);
}

export function fetchDeepDives(med: Medicine, link: TargetLink): Promise<DeepDives | null> {
  return post<DeepDives>("/deepdive", `deepdive:v1:${med.id}:${link.target.uniprotId}`, ["sideEffects", "metabolism"], med, link);
}
