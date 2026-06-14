import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_LINE_SETTINGS, type LineSettings } from "@/lib/line/settings-types";

export type { LineSettings } from "@/lib/line/settings-types";

export async function getLineSettings(supabase: SupabaseClient): Promise<LineSettings> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "line").maybeSingle();
  return { ...DEFAULT_LINE_SETTINGS, ...((data?.value as Partial<LineSettings>) ?? {}) };
}

export async function saveLineSettings(supabase: SupabaseClient, patch: Partial<LineSettings>): Promise<void> {
  const current = await getLineSettings(supabase);
  const merged = { ...current, ...patch };
  await supabase.from("app_settings").upsert({ key: "line", value: merged }, { onConflict: "key" });
}
