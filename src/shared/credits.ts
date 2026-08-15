/**
 * Credit arithmetic for the XEBRA-operated deployment.
 *
 * Credits are integers throughout — no float ever touches a balance. One credit
 * is $0.001 of customer-charged value, matching upstream's
 * AUTUMN_SEO_DATA_CREDITS_PER_USD so display code and mental models carry over
 * from the Autumn-based hosted mode.
 */

/** 1000 credits = 1 USD of charged value. */
export const CREDITS_PER_USD = 1000;

/** Basis-point denominator. 10000 bps = 1.00x. */
const BPS_PER_UNIT = 10_000;

/** No markup: the customer is billed exactly what DataForSEO charged. */
export const NO_MARKUP_BPS = BPS_PER_UNIT;

/** Standard customer markup: 1.25x raw DataForSEO cost. */
export const XEBRA_MARKUP_BPS = 12_500;

/** Warn below $0.25 of remaining balance. */
export const LOW_CREDITS_THRESHOLD = 250;

/**
 * Credits to deduct for a DataForSEO call that cost `rawCostUsd`.
 *
 * Rounds UP, always in XEBRA's favour. At sub-cent per-call costs the rounding
 * gain is negligible, but it guarantees a billed call can never cost zero
 * credits and so be effectively free.
 */
export function creditsForRawCost(
  rawCostUsd: number,
  markupBps: number,
): number {
  if (!Number.isFinite(rawCostUsd) || rawCostUsd <= 0) return 0;

  return Math.ceil(rawCostUsd * (markupBps / BPS_PER_UNIT) * CREDITS_PER_USD);
}

/**
 * Credits granted for a USD payment.
 *
 * Floors, so a fractional cent can never be rounded up into credit the customer
 * did not pay for — the opposite bias to {@link creditsForRawCost}, and
 * deliberately so: both round against the customer's balance, never for it.
 */
export function usdToCredits(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.floor(usd * CREDITS_PER_USD);
}

/** USD value of a credit balance, for display. */
export function creditsToUsd(credits: number): number {
  return credits / CREDITS_PER_USD;
}

/**
 * Raw DataForSEO cost as an exact integer, for internal cost reporting.
 * Micro-USD keeps sub-cent vendor costs exact without storing a float.
 */
export function rawCostToMicroUsd(rawCostUsd: number): number {
  if (!Number.isFinite(rawCostUsd) || rawCostUsd <= 0) return 0;
  return Math.round(rawCostUsd * 1_000_000);
}
