import { createClient } from "@/lib/supabase/server";
import type { WheelAssembly, WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";
import { rawWheelLabel } from "@/lib/wheels/sku";
import { HistoryClient, type SubmissionCard } from "@/components/wheels/history-client";

/**
 * SC Wheels — Production History (operational log). Reads worker production
 * submissions and presents them as date-grouped cards. Read-only; exposes no
 * internal transaction/ledger ids.
 */
export default async function HistoryPage() {
  const supabase = await createClient();

  const [prod, workers, boxes, raw, assemblies] = await Promise.all([
    supabase
      .from("wheels_production")
      .select("id, worker_id, prod_date, submitted_at, wheels_production_items(kind, box_id, assembly_id, qty)")
      .order("submitted_at", { ascending: false })
      .limit(500),
    supabase.from("workers").select("id, name, code"),
    supabase.from("wheels_boxes").select("id, sku, name, raw_id, unit"),
    supabase.from("wheels_raw").select("*"),
    supabase.from("wheels_assemblies").select("id, sku, name, unit"),
  ]);

  // lookups for labels (kept minimal)
  const [finishes, sizes, grooves] = await Promise.all([
    supabase.from("wheels_finishes").select("*").order("sort"),
    supabase.from("wheels_sizes").select("*").order("sort"),
    supabase.from("wheels_grooves").select("*").order("sort"),
  ]);

  const workerById = new Map(((workers.data ?? []) as { id: string; name: string; code: string }[]).map((w) => [w.id, w]));
  const boxById = new Map(((boxes.data ?? []) as (WheelBox & { name: string | null })[]).map((b) => [b.id, b]));
  const rawById = new Map(((raw.data ?? []) as WheelRaw[]).map((r) => [r.id, r]));
  const asmById = new Map(((assemblies.data ?? []) as WheelAssembly[]).map((a) => [a.id, a]));
  const fin = (finishes.data ?? []) as WheelLookup[];
  const siz = (sizes.data ?? []) as WheelLookup[];
  const grv = (grooves.data ?? []) as WheelLookup[];

  type ProdRow = {
    id: string;
    worker_id: string;
    prod_date: string;
    submitted_at: string | null;
    wheels_production_items: { kind: "pack" | "assemble"; box_id: string | null; assembly_id: string | null; qty: number }[] | null;
  };

  const cards: SubmissionCard[] = [];
  for (const p of (prod.data ?? []) as ProdRow[]) {
    const w = workerById.get(p.worker_id);
    const ts = p.submitted_at ? new Date(p.submitted_at).getTime() : new Date(p.prod_date).getTime();
    const time = p.submitted_at
      ? new Date(p.submitted_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })
      : "—";

    for (const kind of ["pack", "assemble"] as const) {
      const kItems = (p.wheels_production_items ?? []).filter((it) => it.kind === kind && it.qty > 0);
      if (kItems.length === 0) continue;

      const items = kItems.map((it) => {
        if (kind === "pack") {
          const b = it.box_id ? boxById.get(it.box_id) : undefined;
          const r = b ? rawById.get(b.raw_id) : undefined;
          return { label: r ? rawWheelLabel(r, fin, siz, grv) : b?.sku ?? "—", qty: it.qty, unit: b?.unit ?? "กล่อง" };
        }
        const a = it.assembly_id ? asmById.get(it.assembly_id) : undefined;
        return { label: a?.name ?? "—", qty: it.qty, unit: a?.unit ?? "ชิ้น" };
      });
      const total = items.reduce((s, i) => s + i.qty, 0);

      cards.push({
        key: `${p.id}-${kind}`,
        date: p.prod_date,
        time,
        ts,
        worker: w ? `${w.name} (${w.code})` : "—",
        workerId: p.worker_id,
        type: kind,
        total,
        unit: items[0]?.unit ?? (kind === "pack" ? "กล่อง" : "ชิ้น"),
        items,
      });
    }
  }

  const workerList = ((workers.data ?? []) as { id: string; name: string; code: string }[])
    .map((w) => ({ id: w.id, name: `${w.name} (${w.code})` }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));

  return <HistoryClient cards={cards} workers={workerList} />;
}
