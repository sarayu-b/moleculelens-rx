// src/lib/EntitlementsProvider.tsx — who has Lens Pro / Study Pack, shared across screens.
// addCustomerInfoUpdateListener never fires in Expo Go, so screens call refresh() after purchases.
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CustomerInfo } from "react-native-purchases";
import { getCustomerInfo, hasEntitlement, initPurchases } from "./purchases";

type Entitlements = {
  info: CustomerInfo | null;
  isPro: boolean;
  hasStudy: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const EntitlementsContext = createContext<Entitlements | null>(null);

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setInfo(await getCustomerInfo());
    } catch (e) {
      console.warn("getCustomerInfo failed", e); // offline: keep last known info (free plan if none)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Child effects run before the layout's, so make sure RevenueCat is configured first (idempotent).
    initPurchases();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refresh() only sets state after awaiting RevenueCat
    refresh();
  }, [refresh]);

  const value = useMemo<Entitlements>(
    () => ({
      info,
      isPro: hasEntitlement(info, "pro"),
      hasStudy: hasEntitlement(info, "study"),
      loading,
      refresh,
    }),
    [info, loading, refresh]
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements(): Entitlements {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error("useEntitlements must be used inside <EntitlementsProvider>");
  return ctx;
}
