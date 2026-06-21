# Instawards SOW — PayRoute on Stellar (filled)

> **Source of truth for the 30-day engagement.** This markdown mirrors the filled
> Word SOW on the Desktop (`Instawards SOW - PayRoute on Stellar (FILLED).docx`).
> From now on we plan and execute against the deliverables and scope below.

- **Program:** Instawards — 30-Day Scoped Engagement
- **Project:** PayRoute on Stellar — gasless, multisig-gated x402 corporate payments on Soroban
- **Builder:** Özgür Matiloğlu — matilogluo@mef.edu.tr
- **Ambassador Chapter:** Stellar Türkiye · **Lead:** İrem Koçi
- **Date submitted:** 2026-06-20 · **Sprint window:** 2026-06-02 → 2026-07-01
- **Requested budget:** $2,500 USDC *(placeholder — confirm with Chapter Lead)*

## Problem
On Stellar there is no payment primitive that is simultaneously **gasless** for the
payer, gated by an **M-of-N multisig**, bounded by a **per-period spending limit**,
and written to an **immutable audit trail** — while staying compatible with the
canonical x402 facilitator (OZ Relayer), which settles only a direct SEP-41
`transfer` and rejects sub-invocations.

## Objective (end of 30 days)
A working testnet vertical slice: a corporate smart account makes a gasless 2-of-3
multisig, spending-limited USDC payment (payer holds no XLM), recorded in an
on-chain registry, backed by verifiable tx hashes.

## In-scope deliverables
| # | Deliverable | What | Why |
|---|---|---|---|
| D1 | `corporate_account` | Soroban smart account: ed25519 verifier + 2-of-3 threshold + 5 USDC/period limit, enforced in `__check_auth` via a `CallContract(USDC)` rule | Multisig + cap on every treasury payment |
| D2 | `payment_registry` | Recorder-authorized `record_payment`, global count, cumulative totals, `PaymentRecorded` events | Immutable, queryable audit trail off the payment path |
| D3 | Gasless multisig slice | Deploy full stack to testnet; first real gasless 2-of-3 USDC transfer + record + negative tests | Proves end-to-end value on-chain |

## Out of scope
- Mainnet + Circle USDC (testnet uses self-issued SEP-41 SAC)
- Production OZ Relayer x402 facilitator (testnet uses admin key as fee-payer)
- Frontend dashboard rewire to Stellar
- Agent Marketplace (single / batch / pipeline payments)
- Full e2e `corporate_account` test fixtures + security audit

## Weekly plan
- **W1:** Soroban workspace; split payment/audit architecture; pin OZ versions; wire `corporate_account`.
- **W2:** `payment_registry` + unit tests; `CallContract(USDC)` rule + policies.
- **W3:** Deploy verifier/threshold/limit/account/registry to testnet; AuthPayload signing harness.
- **W4:** Gasless 2-of-3 transfer + registry record + negative tests; write up evidence.

## Evidence (delivered — testnet, 2026-06-20)
| Deliverable | Evidence |
|---|---|
| D1 `corporate_account` | `CDJZRXQOI7YJAITMT5PCPZ3YML33BOLH4BMVRW5AO27C73EOIKLXNXPA` |
| D2 `payment_registry` | `CAJPPM6KTENCIKCTUOKEBN3TJZBYRJTRQMCWYTMITOW4EXBXQ3LVCKEP` · record tx `7894668e884e6973272793d5d3e2d0ed1b11a5ed95622b3d924710afbe061399` (`payment_count=2`, `total_paid=3 USDC`) |
| D3 gasless slice | transfer tx `6c6beb30a532bc18015b40131f0b3e65df3306d0931ad5d3ae35bbc9a3113dc2` (payer holds no XLM); negatives `3221 SpendingLimitExceeded`, `3202 threshold not met` |

Network: Stellar testnet (`Test SDF Network ; September 2015`). Full record:
`deployments/testnet.json`. Background: `DOCUMENTATION.md`.

## Deliverables produced this session (2026-06-20)
- Filled SOW: `~/Desktop/Instawards SOW - PayRoute on Stellar (FILLED).docx`
- Presentation: `~/Desktop/PayRoute on Stellar - Sunum.pptx` (7 slides)
- This markdown mirror (repo source of truth)

## Status
FAZ 1–3 complete (deploy + first gasless multisig testnet payment). The three SOW
deliverables are met on testnet; remaining items are out-of-scope roadmap (mainnet,
production facilitator, dashboard, Agent Marketplace, hardening).
