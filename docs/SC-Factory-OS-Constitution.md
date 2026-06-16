# SC Factory OS — Constitution

> **Business philosophy only.** This document defines how SC Factory OS *thinks*, not how
> it is built. It changes very rarely. When a feature decision conflicts with this document,
> this document wins. Technical details live in the implementation snapshot, not here.

---

## 1. Core principles

1. **The system is built around real factory behaviour**, not around an accounting ledger.
   It answers operational questions ("who produced what, and when?", "what do we have to sell?")
   before it answers anything else.
2. **One mental model for everyone.** Every screen — worker, office, admin — describes products
   the same way, in the same order. A worker, an office clerk, and an owner should all picture the
   same thing when they hear a product named.
3. **Clarity over cleverness.** Few concepts, consistently applied, beats many concepts used once.
4. **Nothing is destroyed silently.** Actions that change stock are deliberate, reviewable, and
   leave a trace a human can read.
5. **Exceptions are allowed, but never invisible.** The normal path is optimised for the common
   case; rare cases are supported as clearly-marked exceptions, never by bending the everyday flow.

## 2. Worker responsibilities

- **Workers record only what they finished.** They enter finished output — boxes packed, products
  assembled — and nothing else.
- **Workers never enter raw-material consumption.** What was used up to make the output is the
  system's job to calculate, not the worker's to type.
- **Workers work in their own simple space.** Their tools are fast, focused, and forgiving of
  re-entry; they are not asked to understand inventory accounting.

## 3. Office responsibilities

- **The office records only what was sold.** Sales reduce finished-goods stock; the office owns that
  entry, the worker does not.
- **The office governs the catalog and the exceptions.** Defining products, approving the rare
  out-of-sequence case, and keeping master data correct are office/administration duties.
- **Authority is explicit.** Routine office work and privileged actions (overrides, exceptional
  sales) are different responsibilities held by different roles.

## 4. Inventory philosophy

- **Make to stock.** The factory produces to replenish stock, not against individual customer orders.
- **Stock is the truth that everything else explains.** Every recorded action exists to keep the
  on-hand picture honest.
- **Each kind of stock stands on its own.** Distinct product layers keep their own balances; one is
  never silently inferred from another.
- **The system calculates movements; people cause them.** When a person records an event, the system
  derives every consequent stock movement automatically and consistently.
- **Negative stock is a signal, not a setting.** If the books say there isn't enough, the everyday
  user is stopped and told; only an explicit, recorded human decision may proceed past that signal.

## 5. Review → Confirm → Commit

- **Nothing is saved until a human confirms it.** Every entry is first assembled, then reviewed in
  plain language, then committed as one all-or-nothing step.
- **The review step shows consequences, not just inputs.** Before confirming, the person sees what
  the system will do — including the deductions it will make on their behalf.
- **Commit is atomic.** A confirmed action either happens completely or not at all; there are no
  half-finished records.

## 6. Reverse → Reapply

- **Editing is correcting, not appending.** Re-submitting the same day's work replaces it: the
  system reverses the previous effect and reapplies the corrected one, so balances never drift from
  repeated entry.
- **Corrections are bounded.** A correction only touches the slice of work it belongs to, leaving
  unrelated entries for the same day untouched.

## 7. System suggests, humans decide

- **The system proposes; the human disposes.** Identifiers, defaults, and calculations are offered
  as sensible starting points, always overridable by the person doing the work.
- **Automation removes drudgery, not judgement.** The system does the arithmetic and the bookkeeping;
  the decision to act — and the responsibility for it — stays with people.

## 8. Build in phases

- **Deliver in reviewable phases.** Work advances one coherent slice at a time.
- **Stop at each boundary for approval.** A phase is designed, reviewed, approved, then built — and
  the team stops for sign-off before the next phase begins.
- **Foundations before features.** Shared concepts (how products are grouped, how movements work) are
  settled before the screens that depend on them are built on top.

## 9. Reuse patterns

- **A pattern proven once is reused everywhere.** New capabilities are built from the established
  patterns of the existing system rather than inventing parallel ways to do the same thing.
- **One source of truth per concept.** Each idea (how products are grouped and ordered, how a daily
  submission is committed) has a single canonical definition that every screen draws from.
- **The approved architecture is respected.** Extending the system must not redesign what is already
  approved and working.
```
