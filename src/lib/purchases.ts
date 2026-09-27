// src/lib/purchases.ts
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesPackage } from "react-native-purchases";

// Public Test Store SDK key from RevenueCat → Project settings → API keys. Safe to keep in code.
const RC_TEST_STORE_KEY = "test_PASTE_YOURS_HERE";

let configured = false;
export function initPurchases() {
  if (configured) return; // guard against Fast Refresh calling this twice
  Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
  Purchases.configure({ apiKey: RC_TEST_STORE_KEY });
  configured = true;
}

export async function getPackages(): Promise<PurchasesPackage[]> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function buy(pkg: PurchasesPackage): Promise<CustomerInfo> {
  await Purchases.purchasePackage(pkg);
  // In Expo Go the customer-info listener never fires, so always re-fetch.
  return Purchases.getCustomerInfo();
}

export const getCustomerInfo = () => Purchases.getCustomerInfo();
export const restore = () => Purchases.restorePurchases();

export function hasEntitlement(info: CustomerInfo | null, id: "pro" | "study") {
  return !!info && info.entitlements.active[id] !== undefined;
}
