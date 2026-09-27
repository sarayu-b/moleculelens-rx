// src/lib/entitlements.ts — what the free plan allows. Safety warnings are never gated.
import { getCustomerInfo, hasEntitlement } from "./purchases";

export const FREE_CABINET_LIMIT = 3;

export async function isPro(): Promise<boolean> {
  try {
    return hasEntitlement(await getCustomerInfo(), "pro");
  } catch {
    return false; // offline or RevenueCat unavailable: treat as free plan
  }
}

// True when adding one more medicine needs Lens Pro.
export async function cabinetAddNeedsPro(currentCount: number): Promise<boolean> {
  if (currentCount < FREE_CABINET_LIMIT) return false;
  return !(await isPro());
}
