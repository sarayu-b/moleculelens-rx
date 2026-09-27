// src/lib/entitlements.ts — what the free plan allows. Safety warnings are never gated.
// Live entitlement state comes from useEntitlements() (src/lib/EntitlementsProvider.tsx).

export const FREE_CABINET_LIMIT = 3;

// True when adding one more medicine needs Lens Pro.
export function cabinetAddNeedsPro(currentCount: number, isPro: boolean): boolean {
  return currentCount >= FREE_CABINET_LIMIT && !isPro;
}
