"use client";

import { createContext, useContext } from "react";
import { DEFAULT_STORE_RULES, type StoreRules } from "@/lib/store-settings";

// Store rules (tax, shipping) for client components; the root layout passes the current values.
const Ctx = createContext<StoreRules>(DEFAULT_STORE_RULES);

export function StoreRulesProvider({ rules, children }: { rules: StoreRules; children: React.ReactNode }) {
  return <Ctx.Provider value={rules}>{children}</Ctx.Provider>;
}

export const useStoreRules = () => useContext(Ctx);
