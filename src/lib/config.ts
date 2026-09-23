// Admin settings (server-only): read with defaults, cached per request.
import { cache } from "react";
import { DEFAULT_CONFIG, mergeDefaults, type ConfigSection, type ConfigSections } from "@/lib/config-shared";
import { db } from "@/lib/db";

export const getConfig = cache(async <S extends ConfigSection>(section: S): Promise<ConfigSections[S]> => {
  const row = await db.storeConfig.findUnique({ where: { section } });
  return mergeDefaults(DEFAULT_CONFIG[section], row?.value);
});

export async function saveConfig<S extends ConfigSection>(section: S, value: ConfigSections[S]) {
  const clean = mergeDefaults(DEFAULT_CONFIG[section], value);
  await db.storeConfig.upsert({ where: { section }, create: { section, value: clean }, update: { value: clean } });
}
