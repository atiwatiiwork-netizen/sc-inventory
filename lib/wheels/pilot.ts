/* ============================================================================
 *  SC Factory OS — Phase B2 pilot config (Stock Reality Check).
 *
 *  The Stock Reality Check pilot shows finished-goods availability for a small
 *  set of packed-box SKUs only. List the box SKUs to pin the pilot set here.
 *  If the list is empty, the screen shows the first PILOT_LIMIT active boxes
 *  (in the canonical Version → Size → Groove order) so the pilot works
 *  out-of-the-box on the current small catalog.
 *
 *  This is a business-validation pilot — no targets, no planning, no analytics.
 * ==========================================================================*/

/** Packed-box SKUs to include in the pilot. Empty = first PILOT_LIMIT active boxes. */
export const PILOT_BOX_SKUS: string[] = [];

/** Pilot size when no explicit allowlist is set. */
export const PILOT_LIMIT = 6;
