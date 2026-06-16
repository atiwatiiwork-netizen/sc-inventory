"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { Btn, Panel, ScreenHead } from "@/components/ui";
import { SalesClient, type Sellable } from "@/components/wheels/sales-client";
import type { WheelLookup } from "@/lib/wheels/types";
import { submitWorkerSale } from "@/app/worker/(secure)/wheels/actions";

/** A previously recorded sale, summarised for the worker landing list. */
export type WorkerSaleRow = {
  id: string;
  date: string;
  customer: string | null;
  summary: string;
  totalQty: number;
  voided: boolean;
};

/**
 * Worker-side Sales landing — list of recorded sales first, with an add button
 * that reveals the existing SalesClient entry form (reusing the grouped SKU
 * layout + the same commit/shortage model). The worker commit action is RBAC
 * gated; this page is only reachable when the 'wheels-sales' function is allowed.
 */
export function WorkerSalesClient({
  sellables,
  today,
  finishes,
  sizes,
  grooves,
  history,
}: {
  sellables: Sellable[];
  today: string;
  finishes: WheelLookup[];
  sizes: WheelLookup[];
  grooves: WheelLookup[];
  history: WorkerSaleRow[];
}) {
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <div style={{ padding: "16px 14px 32px", maxWidth: 880, margin: "0 auto" }}>
        <button
          onClick={() => setShowForm(false)}
          className="focusable"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: "var(--accent)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", marginBottom: 12, padding: 0 }}
        >
          <Icon name="chevR" size={15} style={{ transform: "rotate(180deg)" }} /> กลับไปรายการขาย
        </button>
        <SalesClient
          mode="standard"
          sellables={sellables}
          isAdmin={false}
          today={today}
          finishes={finishes}
          sizes={sizes}
          grooves={grooves}
          onRecord={submitWorkerSale}
          onSaved={() => setShowForm(false)}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 14px 32px", maxWidth: 720, margin: "0 auto" }}>
      <ScreenHead
        th="บันทึกการขาย"
        en="Sales Entry"
        right={
          <Btn kind="primary" icon="plus" size="sm" onClick={() => setShowForm(true)}>
            บันทึกการขาย
          </Btn>
        }
      />
      <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 16 }}>
        ดูรายการขายที่บันทึกไว้ และเพิ่มรายการขายใหม่
      </div>

      <Panel title="รายการขายล่าสุด" en="Recent sales" pad={0}>
        {history.length === 0 ? (
          <div style={{ padding: 26, textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>ยังไม่มีรายการขาย</div>
        ) : (
          history.map((s, i) => (
            <div
              key={s.id}
              style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 16px", borderBottom: i === history.length - 1 ? "none" : "1px solid var(--surface-3)", opacity: s.voided ? 0.5 : 1 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {s.date}
                  {s.customer ? <span style={{ fontWeight: 500, color: "var(--ink-3)" }}> · {s.customer}</span> : null}
                  {s.voided ? <span className="pill grey" style={{ marginLeft: 8 }}>ยกเลิกแล้ว</span> : null}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5 }}>{s.summary}</div>
              </div>
              <div className="tnum" style={{ fontSize: 16, fontWeight: 700, flex: "none" }}>
                {s.totalQty.toLocaleString()}
              </div>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
