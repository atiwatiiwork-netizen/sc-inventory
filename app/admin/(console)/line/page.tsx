import { createClient } from "@/lib/supabase/server";
import { getLineSettings } from "@/lib/settings";
import { gatherDaily } from "@/lib/line/data";
import { LineSettingsClient } from "@/components/line-settings-client";

export default async function LinePage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [settings, preview] = await Promise.all([getLineSettings(supabase), gatherDaily(supabase, today)]);

  return <LineSettingsClient initial={settings} preview={preview} />;
}
