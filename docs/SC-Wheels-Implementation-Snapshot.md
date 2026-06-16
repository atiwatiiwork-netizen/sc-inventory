# SC Wheels — Current Implementation Snapshot

> **Technical snapshot of today's system. Current reality only — no redesign, no invented features.**
> Snapshot date: 2026-06-16. SC Wheels is a make-to-stock manufacturing module living inside the
> existing SC Inventory app, sharing login, admin/worker auth, the Supabase DB, the admin shell, and
> the LINE framework. It does not modify SC Inventory.

---

## Current product hierarchy

Canonical, used identically across every SC Wheels screen:

```
Version  →  Size  →  Groove
```

- **Version** and **Size** are the primary grouping levels; **Groove** is the leaf.
- **Size always sorts small → large** (driven by a sort value on the lookup).
- Single source of truth: `lib/wheels/grouping.ts` (`groupRawWheels`, `groupBoxes`,
  `groupByHierarchy`, `flattenGroups`). Display-only; storage stays SKU-level.

Lookup values (all extensible, admin-editable — see Attributes module):
- **Versions:** seeded **Chromium**, **Zinc-Plating** (configurable; ids `chrome`/`zinc`).
- **Sizes:** 2", 2.5", 3", 3" Thick, 4".
- **Grooves:** **U, V, W** (canonical; migrated from earlier Round/Angle/Double naming).

## Current product families (inventory layers)

Three separate entities, each its own SKU type **and** its own stock balance:

1. **Raw wheel** — unique on `Version × Size × Groove`. Arrives from suppliers (received, not manufactured).
2. **Packed box** — references exactly one raw wheel + `units_per_box` (default 50; some 4" variants differ).
3. **Assembly** — finished product defined through a BOM (not a wheel variant).

## Current inventory layers

| Layer | Stock IN | Stock OUT |
|---|---|---|
| Raw wheel | Supplier receiving | Auto-consumed by packing & assembly · rare direct raw sale (admin) |
| Packed box | Packing (worker) | Sale (office) · auto-consumed by assembly when a BOM line is a box |
| Assembly | Assembly (worker) | Sale (office) |

Each layer holds its own balance; balances are never inferred across layers.

## Current movement types

A single ledger records every movement with a signed quantity, layer, source, and actor (no UI exposure of ids):
- `receive` — raw +
- `pack_in` — box +
- `assemble_in` — assembly +
- `consume` — raw/box − (system-calculated via `units_per_box` or BOM; never entered by hand)
- `sale` — box/assembly/raw −

## Current production types (worker)

- **Packing** (`pack`) — finished boxes; auto-consumes raw by `units_per_box`.
- **Assembly** (`assemble`) — finished assemblies; auto-consumes raw and/or boxes by BOM.
- Raw wheels are **not** produced by workers (received only). Packing and assembly are **separate
  worker workflows/screens**, sharing one daily submission header but merging per production kind.

## Current worker workflows

- PIN login → module switcher (SC Inventory ⇄ SC Wheels) → choose **Packing**, **Assembly**, or
  **Stock Check** (the worker sees only the functions allowed for their role — see Worker roles below).
- Packing/Assembly are daily, review-before-confirm flows: enter finished output → review (showing the
  **read-only auto-deductions** the system will make) → confirm.
- One submission header per (worker, day); re-submitting a kind **reverses and reapplies** only that
  kind's effect (correction, not duplication).
- **Shortage soft-block:** if a deduction would drive a layer negative, the worker is stopped and
  shown the shortage. Workers cannot override.
- **Stock Reality Check** is now also available in the worker area (same finished-goods availability
  list as the admin pilot, read-only).

## Current worker roles & function access (RBAC)

- **Scope: SC Wheels worker area only.** SC Inventory's worker daily-usage is not role-gated.
- **One role per worker** (`workers.role_id`); existing workers default to the protected system role
  `general` (which cannot be deleted, renamed, or deactivated).
- **Function availability, not ERP permissions** — admins map which roles may use each SC Wheels worker
  function (Packing / Assembly / Stock Check) via a `function × role` matrix.
- **Default-open:** a function with **no** role mapping is usable by everyone; once roles are mapped,
  only those roles see the function (others have the card hidden and the route redirects).
- Roles are managed at `/admin/wheels/worker-access`; a worker's role is assigned in the existing PIN
  page (`/admin/workers`). Access is resolved live per request (role changes need no re-login).

## Current office / admin workflows

- **Raw Receiving** — admin/office, review-before-confirm; increases raw stock.
- **Sales (standard)** — admin/office; sells boxes and assemblies; customer is optional.
- **Raw-Wheel Sale (exception)** — admin-only screen, hidden from office; the rare direct raw sale.
- **Shortage override** — only an admin may proceed past a shortage; a **reason is required** and the
  override is recorded (who, layer, shortage, reason, time) and visible in audit history.
- **Attributes** — admin-only CRUD for Versions / Sizes / Grooves (label TH/EN + sort), so new
  product lines (e.g. Nylon, Stainless) are added without a migration or deploy.
- **Role split:** `admin` (full authority) vs `office` (standard sales, no override, no raw sale).

## Current BOM support

- Assemblies own a bill of materials of typed lines: `raw`, `box`, or `part`.
- `raw` and `box` lines **auto-deduct** their layer on assembly (quantity × output).
- `part` lines are free-text and **untracked** (no part inventory layer today; informational only).
- Edited in the assembly catalog (add/remove lines).

## Current packaging support

- A packed box = one raw wheel + `units_per_box`. Packing produces boxes and auto-consumes
  `units_per_box × boxes` of the referenced raw wheel.
- Box SKUs can be created singly or in bulk (auto-suggested codes, editable units-per-box).

## Current production history support

- `/admin/wheels/history` — operational log answering "who produced what, and when?".
- Grouped by **date** (newest first); one card per (worker, day, production type) showing time,
  worker, type, total + unit; expandable to per-product lines (Version→Size→Groove · qty · unit · subtotal).
- Filters: **date range, worker, production type.** No internal/transaction ids shown.
- Reads worker submissions only (packing + assembly). It is read-only.

## Current database assumptions

- SC Wheels uses **separate `wheels_*` tables**; the approved SC Inventory schema is untouched.
- Shared tables only: `workers` (gains `role_id` → `worker_roles`), `profiles` (the `role` column drives
  admin/office), `audit_log`.
- Lookups (`version`/`size`/`groove`) are extensible tables with a `sort` column.
- A raw wheel is unique on `(finish, size, groove)`; per-layer balances are stored as a `stock` column.
- All stock-changing logic lives in `SECURITY DEFINER` RPCs; admins act under RLS, workers act via the
  service role. Shortage validation and override live inside the RPC (cannot be bypassed via the API).
- Migrations are run manually in Supabase, in order: `wheels-phase1.sql` → `wheels-phase2.sql` →
  `wheels-phase3.sql` → `wheels-phase4.sql` (worker roles + function access). Each is idempotent.
  Postgres functions use unique dollar-quote tags.

## Current UI assumptions

- Next.js 16 App Router with route groups: `admin/(console)/wheels/*` and `worker/(secure)/wheels/*`.
- A module switcher appears in both the admin sidebar and the worker shell.
- Shared UI kit (`components/ui.tsx`); product grouping always via `lib/wheels/grouping.ts`.
- Thai-primary bilingual labels; worker production flows are mobile-friendly.
- Catalog labels say **"Version"** (the lookup table is internally still named `wheels_finishes`).

## Current architecture constraints

- Must not redesign SC Inventory, nor the approved SC Wheels Phase 1/2 movement logic.
- Development proceeds in **approved phases** with stop-for-review boundaries.
- Edits use **reverse-then-reapply**, and that reversal is **destructive** in the ledger (the prior
  rows are removed, not flagged) — so there is no retained timeline of reversed/corrected states.
- Auto-deductions exist only inside RPCs; they are never entered or editable by users.
- Workers enter finished output only; the office enters sales only.

---

## COMPLETED

- **Module foundation:** SC Inventory ⇄ SC Wheels switcher (admin + worker), wheels landing with
  per-layer balance cards.
- **Catalog:** raw wheels, packed boxes, assemblies + BOM editor (single-create).
- **Attributes:** extensible Version/Size/Groove lookups + admin CRUD screen.
- **Catalog UX:** raw-wheel **version tabs**; **bulk creation** for raw wheels and for packed boxes
  (Version → Size×Groove grid, "already exists" prevention, review-before-create).
- **Grouping & terminology foundation:** Version→Size→Groove everywhere; grooves U/V/W; "Version"
  relabel.
- **Movement model (Phase 2):** raw receiving; worker packing; worker assembly; standard sales
  (box/assembly); admin-only raw-wheel sale; auto-deductions (units_per_box + BOM); per-layer
  balances + unified ledger; shortage soft-block with admin override (reason required, audited);
  role gating (admin/office); reverse-then-reapply edits; void sale.
- **Production History** screen (date-grouped, filterable, expandable, no ids).
- **Stock Reality Check (B2 pilot):** read-only finished-goods (packed-box) availability list,
  searchable, in admin **and** the worker area.
- **Worker Roles / Function Access (RBAC):** one role per worker; SC Wheels worker-area scope only;
  protected system role `general`; admin roles CRUD + `function × role` matrix; **default-open**
  (unmapped function = everyone); role assigned in the existing PIN page.
- All of the above is deployed to production (Vercel) from `main`.

## IN PROGRESS

- *(None active.)* The most recent delivery — Production History — is complete and under review.

## FUTURE (deferred — not built; do not assume these exist)

- SC Wheels **dashboard** (analytics beyond the basic balance cards).
- SC Wheels **reports**.
- **Low-stock alerts** for wheels (`min_stock` fields exist on all layers but are unused in the UI).
- **LINE notifications** for SC Wheels.
- **Receiving history** and **sales history** screens (only *production* history exists today).
- **Office/admin role assignment UI** — the `admin` vs `office` split (`profiles.role`) is still set
  directly in the database. (Worker roles are now managed in-app; this item is the separate office/admin role.)
- **RBAC beyond SC Wheels** — worker role gating currently covers SC Wheels worker functions only.
- **Non-destructive reversal/correction history** (needed before History could show Reversed/Corrected states).

## Known future extension points

- **Lookups are configurable** — new Versions, Sizes, Grooves require no migration or deploy.
- **Production-type set** (`pack` | `assemble`) is a closed union; a third worker production kind is an
  additive change (extend the union + label maps + the page's kind resolver).
- **Submission status** — `wheels_production.status` already exists in the DB; a status field/badge in
  History is additive. A *history of transitions* is not (see architecture constraints).
- **Ledger `source_kind`** is open-ended; new movement sources can be added.
- **BOM `part` lines** are currently untracked; promoting parts to a tracked inventory layer is a
  future data-model decision.
- **Production History** card DTO is additive-friendly (a submission identifier or status slots in
  without restructuring the page).
```
