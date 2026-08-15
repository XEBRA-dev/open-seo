# XEBRA credit billing — setup

Prepaid credit billing for the XEBRA-operated deployment. Replaces upstream's
Autumn integration; the two never run at the same time.

**1000 credits = $1** of charged value. Spend is metered per DataForSEO call at
the organization's markup (default 1.25x); purchases convert 1:1, so a customer
paying $50 sees exactly 50,000 credits appear.

## What already works without any keys

Everything except card payments:

- Per-call metering and the credit ledger
- Per-organization markup and metered/unlimited policy
- Manual credit grants (`grantCredits`), which is how invoiced customers and
  XEBRA's own workspaces are funded
- The `/billing` page: balance, low-balance warning, history

Only the **Buy credits** buttons and the webhook need Stripe.

## Enabling billing

Set on the Worker:

```
BILLING_PROVIDER=xebra
```

Unset (or `none`) means no metering at all — current behaviour, unchanged. This
fails open deliberately: a deployment that has not opted in must keep working.

`BILLING_PROVIDER` must be set in **both** the runtime env and the client build
env, the same deploy-time contract `AUTH_MODE` already has. The server decides
whether to meter; the client decides whether to render the credits UI.

### Per-organization policy

An organization with no config row is **unlimited at raw cost**. That is also
deliberate: failing closed would lock XEBRA out of its own tool on the first
deploy, since the existing workspace has no row and a zero balance.

Customer organizations must be given an explicit policy:

| field       | customer        | XEBRA's own       |
| ----------- | --------------- | ----------------- |
| `mode`      | `metered`       | `unlimited`       |
| `markupBps` | `12500` (1.25x) | `10000` (at cost) |

`mode` and `markupBps` are independent — a metered org at cost, or an unlimited
org still accruing marked-up charges for later invoicing, are both valid.

`markupBps` is floored at 10000, so a mistyped value cannot sell usage below
cost.

## Stripe

Only two secrets are needed. There is **no dashboard product setup** — prices
are defined in `src/shared/credit-packs.ts` and sent inline as `price_data`.

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Optional:

```
STRIPE_CURRENCY=usd          # default; see the FX note below
OPERATOR_EMAIL_DOMAIN=xebra.dev   # default; who may grant credits
```

### Webhook

Point a Stripe webhook endpoint at:

```
https://seo.xebra.dev/api/stripe/webhook
```

Subscribe to **`checkout.session.completed`** only. Copy the signing secret into
`STRIPE_WEBHOOK_SECRET`.

Test locally with:

```
stripe listen --forward-to localhost:5173/api/stripe/webhook
stripe trigger checkout.session.completed
```

### Response codes

Stripe retries on any non-2xx, so the handler is deliberate about them:

| situation                                       | status | why                                           |
| ----------------------------------------------- | ------ | --------------------------------------------- |
| bad/absent signature                            | 400    | someone claiming a payment succeeded          |
| event type we ignore                            | 200    | nothing to do; do not retry                   |
| unfulfillable event (unknown pack, missing org) | 200    | the retry would fail identically              |
| already fulfilled                               | 200    | replay; the unique index caught it            |
| credit write failed                             | 500    | retry, so a paying customer is not left short |

### Safety properties

- **Replay-safe.** `credit_ledger.stripe_payment_intent_id` has a partial unique
  index, so a replayed webhook cannot double-credit.
- **Metadata is untrusted.** The credit amount comes from the pack table keyed by
  pack id, never from the `credits` metadata value Stripe echoes back. A
  mismatch is refused, not honoured.
- **The organization comes from the session**, which was created server-side from
  the authenticated context — never from the request body.

### Swedish VAT

`automatic_tax` is enabled on every session. Turn on Stripe Tax in the
dashboard and register the Swedish VAT number for MOMS and EU B2B reverse
charge to be applied. It is harmless while Stripe Tax is off.

## The FX caveat

Credits are USD-denominated because DataForSEO bills in USD. Selling in SEK via
`STRIPE_CURRENCY` means the 25% margin absorbs EUR/SEK/USD movement between
purchase and spend. Prepayment collateralises the risk but does not remove it.

## Operational notes

- **Balance is derived** (`SUM(delta_credits)`), never stored, so it cannot
  disagree with history. Revisit only past ~100k rows for one organization.
- **An organization can go slightly negative.** Spend is recorded
  unconditionally, because the cost is unknown until DataForSEO has already
  charged us — refusing to record it would lose the only accurate record of
  XEBRA's true cost. The next balance check blocks them. This is intended.
- **The ledger is append-only.** Corrections are new rows (`adjustment`), never
  edits, so the history is always auditable.
