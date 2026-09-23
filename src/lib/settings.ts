// Store rules from the database (server-only), read once per request.
import { cache } from "react";
import { db } from "@/lib/db";
import { DEFAULT_STORE_RULES, type StoreRules } from "@/lib/store-settings";

export const getStoreRules = cache(async (): Promise<StoreRules> => {
  const row = await db.storeSettings.findUnique({ where: { id: 1 } });
  if (!row) return DEFAULT_STORE_RULES;
  return {
    freeShippingFrom: Number(row.freeShippingFrom),
    shippingFee: Number(row.shippingFee),
    taxPercent: Number(row.taxPercent),
    lowStockAt: row.lowStockAt,
  };
});
