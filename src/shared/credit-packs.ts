import { CREDITS_PER_USD } from "./credits";

type CreditPack = {
  id: string;
  label: string;
  /** Credits granted on successful payment. */
  credits: number;
  /** Price in the smallest currency unit (cents for USD). */
  amountMinor: number;
};

/**
 * Prepaid credit packs.
 *
 * Credits are denominated in charged USD (1000 credits = $1), so a pack's price
 * is a straight 1:1 conversion — the 25% markup is applied when spending, not
 * when buying. That keeps the purchase side honest: a customer paying $50 can
 * see exactly $50 of balance appear.
 *
 * `assertCreditPacksConsistent` (see credit-packs.test.ts) pins that identity so
 * a hand-edited price can never silently sell credits at the wrong rate.
 */
export const CREDIT_PACKS: readonly CreditPack[] = [
  { id: "pack-25", label: "$25", credits: 25_000, amountMinor: 2_500 },
  { id: "pack-50", label: "$50", credits: 50_000, amountMinor: 5_000 },
  { id: "pack-100", label: "$100", credits: 100_000, amountMinor: 10_000 },
  { id: "pack-250", label: "$250", credits: 250_000, amountMinor: 25_000 },
] as const;

export function findCreditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === id);
}

/** Credits a pack must grant for its price, at the canonical rate. */
export function expectedCreditsForAmountMinor(amountMinor: number): number {
  return (amountMinor / 100) * CREDITS_PER_USD;
}
