import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { useCoupons, useItems, useStaples, type Coupon, type Family, type Item, type Staple, type Store } from "./db";
import { loadPrices, type PriceData } from "./prices";

type Ctx = {
  user: User;
  email: string;
  family: Family;
  stores: Store[];
  chains: string[]; // lanci s cijenama, među odabranim trgovinama
  items: Item[] | null;
  staples: Staple[] | null;
  coupons: Coupon[] | null;
  prices: PriceData | null;
  storeName: (id: string) => string;
  chainName: (code: string) => string;
};

const C = createContext<Ctx | null>(null);

export function AppProvider({ user, family, children }: { user: User; family: Family; children: React.ReactNode }) {
  const items = useItems(family.id);
  const staples = useStaples(family.id);
  const coupons = useCoupons(family.id);
  const [prices, setPrices] = useState<PriceData | null>(null);
  useEffect(() => {
    loadPrices().then(setPrices);
  }, []);
  const value = useMemo<Ctx>(() => {
    const stores = family.stores ?? [];
    const chains = stores.map((s) => s.chain).filter((c): c is string => !!c && !!prices?.chains[c]);
    return {
      user,
      email: (user.email ?? "").toLowerCase(),
      family,
      stores,
      chains,
      items,
      staples,
      coupons,
      prices,
      storeName: (id) => stores.find((s) => s.id === id)?.name ?? "",
      chainName: (code) => stores.find((s) => s.chain === code)?.name ?? prices?.chains[code]?.name ?? code,
    };
  }, [user, family, items, staples, coupons, prices]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useApp(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("Nema konteksta aplikacije.");
  return v;
}
