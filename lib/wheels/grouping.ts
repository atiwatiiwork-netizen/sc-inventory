import type { WheelBox, WheelLookup, WheelRaw } from "@/lib/wheels/types";

/* ============================================================================
 *  SC Wheels — the ONE source of truth for how wheel products are grouped and
 *  ordered across the WHOLE module (receiving, packing, assembly, sales,
 *  inventory, dashboards, reports, LINE).
 *
 *  Canonical hierarchy:  Version → Size → Groove
 *    - Version + Size are the primary grouping levels.
 *    - Groove (U/V/W) is the final leaf.
 *    - Size is ALWAYS ordered small → large (driven by wheels_sizes.sort);
 *      Version by wheels_finishes.sort; Groove by wheels_grooves.sort.
 *
 *  Grouping is display-only — storage always stays SKU-level. Mirrors the
 *  SC Inventory rail pattern in lib/grouping.ts.
 * ==========================================================================*/

const sortOf = (rows: WheelLookup[], id: string) => rows.find((r) => r.id === id)?.sort ?? 9999;

export const versionLabel = (versions: WheelLookup[], id: string) => versions.find((v) => v.id === id)?.en ?? id;
export const sizeLabel = (sizes: WheelLookup[], id: string) => sizes.find((s) => s.id === id)?.en ?? id;
export const grooveLabel = (grooves: WheelLookup[], id: string) => grooves.find((g) => g.id === id)?.en ?? id;

export type SizeGroup<T> = { sizeId: string; sizeLabel: string; items: T[] };
export type VersionGroup<T> = { versionId: string; versionLabel: string; sizes: SizeGroup<T>[] };

/** Wheel coordinates of an item (version × size × groove). */
type Coord = { version: string; size: string; groove: string };

/**
 * Group any wheel-based items into the canonical Version → Size → Groove
 * hierarchy. Items inside a size group are ordered by groove; sizes small →
 * large; versions by their lookup order.
 */
export function groupByHierarchy<T>(
  items: T[],
  coord: (t: T) => Coord,
  versions: WheelLookup[],
  sizes: WheelLookup[],
  grooves: WheelLookup[],
): VersionGroup<T>[] {
  const vMap = new Map<string, Map<string, T[]>>();
  for (const it of items) {
    const { version, size } = coord(it);
    let sMap = vMap.get(version);
    if (!sMap) {
      sMap = new Map();
      vMap.set(version, sMap);
    }
    const arr = sMap.get(size) ?? [];
    arr.push(it);
    sMap.set(size, arr);
  }

  const out: VersionGroup<T>[] = [];
  for (const [versionId, sMap] of vMap) {
    const sizeGroups: SizeGroup<T>[] = [];
    for (const [sizeId, arr] of sMap) {
      arr.sort((a, b) => sortOf(grooves, coord(a).groove) - sortOf(grooves, coord(b).groove));
      sizeGroups.push({ sizeId, sizeLabel: sizeLabel(sizes, sizeId), items: arr });
    }
    sizeGroups.sort((a, b) => sortOf(sizes, a.sizeId) - sortOf(sizes, b.sizeId)); // small → large
    out.push({ versionId, versionLabel: versionLabel(versions, versionId), sizes: sizeGroups });
  }
  out.sort((a, b) => sortOf(versions, a.versionId) - sortOf(versions, b.versionId));
  return out;
}

/** Raw wheels carry their own version/size/groove. */
export function groupRawWheels(
  raw: WheelRaw[],
  versions: WheelLookup[],
  sizes: WheelLookup[],
  grooves: WheelLookup[],
): VersionGroup<WheelRaw>[] {
  return groupByHierarchy(raw, (r) => ({ version: r.finish, size: r.size, groove: r.groove }), versions, sizes, grooves);
}

/** Boxes inherit their version/size/groove from the raw wheel they pack. */
export function groupBoxes(
  boxes: WheelBox[],
  rawById: Map<string, WheelRaw>,
  versions: WheelLookup[],
  sizes: WheelLookup[],
  grooves: WheelLookup[],
): VersionGroup<WheelBox>[] {
  return groupByHierarchy(
    boxes,
    (b) => {
      const r = rawById.get(b.raw_id);
      return { version: r?.finish ?? "", size: r?.size ?? "", groove: r?.groove ?? "" };
    },
    versions,
    sizes,
    grooves,
  );
}

/** Flatten a grouped hierarchy back into hierarchy-ordered items (for tables/reviews). */
export function flattenGroups<T>(groups: VersionGroup<T>[]): T[] {
  return groups.flatMap((v) => v.sizes.flatMap((s) => s.items));
}
