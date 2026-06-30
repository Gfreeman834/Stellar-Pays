# PayRoute on Stellar — Project Documentation

**Gasless, multisig-gated, spending-limited x402 corporate payments on Soroban.**

PayRoute lets a company spend from a shared treasury wallet where every payment
must clear an **M-of-N approval** and a **per-period spending limit**, the payer
**holds no XLM** (the facilitator pays the fee), and every settled payment lands
in an **immutable on-chain audit registry** — while staying compatible with the
canonical "Built on Stellar" x402 facilitator.

This document covers what the project is, why it is built the way it is, what is
already done on testnet (with proof), and what is planned next.

---

## 1. Context & origin

PayRoute started as an EVM (Base) x402 payment router:

- `contracts/src/PaymentRouter.sol` — routes gasless EIP-3009 USDC payments from a
  corporate multisig to any registered dApp (games, DEX, APIs, AI services).
- `CorporateVault.sol` (Safe-based treasury) + `CorporateAgent.sol`.
- A Next.js 15 + wagmi v2 + RainbowKit + Safe SDK frontend, with
  `app/api/x402/require` and `app/api/x402/facilitate` endpoints.

This workspace (`contracts-stellar/`) is the **Stellar / Soroban port** of that
system. The port is organized in phases (FAZ = phase):

- **FAZ 1–2** — Soroban workspace, contract wiring, registry skeleton + tests.
- **FAZ 3** — live vertical slice: deploy + first real gasless multisig testnet
  payment, recorded off-path. **Done** (see §5 Evidence).

---

## 2. The core design constraint

The canonical "Built on Stellar" x402 facilitator (OpenZeppelin Relayer plugin)
only settles a **direct SEP-41 `transfer`** from the payer, and **rejects**
sub-invocations and a facilitator appearing in the auth tree. So a payment
**cannot** be routed *through* a wrapper/router contract during settlement —
the EVM "router in the payment path" model does not port directly.

PayRoute resolves this by **splitting the payment path from the audit path**:

```
PAYMENT PATH (on-chain, settled by the facilitator)
  USDC.transfer(from = CorporateAccount, to = merchant, amount)
        |  require_auth(CorporateAccount)
        v
  CorporateAccount.__check_auth  ->  multisig threshold + spending-limit policies
        |
        v
  Facilitator fee-bumps + submits ->  user holds no XLM (gasless)

AUDIT PATH (off-chain trigger, separate tx)
  PayRoute backend -> PaymentRegistry.record_payment(payer, merchant, token, amount, txHash)
```

The payment stays a **plain SEP-41 transfer** (facilitator-compatible) while the
multisig + spending limit are enforced inside the corporate account's
`__check_auth`, and the audit trail is produced by a separate recorder-authorized
transaction.

---

## 3. Contracts

| Crate | Role | Notes |
|---|---|---|
| `corporate_account` | The payer treasury wallet, a Soroban **smart account**. Multisig threshold + spending limit run in `__check_auth`. | Wiring follows the OpenZeppelin `multisig-smart-account` example. |
| `payment_registry` | Off-path audit trail + cumulative per-payer totals. Recorder-authorized `record_payment`. | Self-contained; no external deps. |

### corporate_account

A deployed corporate account **composes three reusable OpenZeppelin contracts**
(deployed once, referenced by address), passed in at construction:

- an **ed25519 verifier** — validates employee/delegate signatures,
- a **threshold policy** — M-of-N multisig (deployed as 2-of-3),
- a **spending-limit policy** — per-period cap (deployed as 5 USDC / period).

The constructor installs a `CallContract(target)` context rule pinned to the USDC
SEP-41 contract, so **every** USDC transfer from the account must satisfy both the
multisig threshold and the spending limit. (The spending-limit policy requires a
`CallContract` rule; `Default` is rejected with `3227 OnlyCallContractAllowed`.)

`__check_auth` delegates to `stellar_accounts::smart_account::do_check_auth`, which
validates the signed `AuthPayload` against the context rules and enforces the
installed policies.

### payment_registry

`record_payment(payer, merchant, token, amount, reference)` — recorder-authorized;
`reference` is the settlement tx hash so each record links back to the on-chain
transfer. Maintains a global `payment_count`, a cumulative `total_paid(payer)`
(persistent, TTL-extended), and emits a `PaymentRecorded` event. `set_recorder`
is admin-authorized for key rotation.

---

## 4. EVM → Stellar mapping

| EVM (`contracts/`) | Stellar (`contracts-stellar/`) |
|---|---|
| `CorporateVault.sol` (Safe) | `corporate_account` (OZ smart account: multisig + limits) |
| `PaymentRouter.sol` `routePayment` in-path | direct SEP-41 transfer + off-path `payment_registry` |
| EIP-3009 `transferWithAuthorization` | Soroban authorization entry on SEP-41 `transfer` |
| ERC-20 USDC | SEP-41 USDC |
| Coinbase facilitator broadcasts | OZ Relayer x402 facilitator fee-bumps + sponsors |

### Pinned versions

- `soroban-sdk = 26.1.0` (feature `experimental_spec_shaking_v2`)
- `stellar-accounts = 0.7.1`, `stellar-contract-utils = 0.7.1`
- toolchain `stable`, target `wasm32v1-none`

---

## 5. Status & evidence (testnet — FAZ 3 done)

Network: **Stellar testnet** (`Test SDF Network ; September 2015`),
RPC `https://soroban-testnet.stellar.org`, deployed **2026-06-20**.

### Deployed contracts

| Contract | ID |
|---|---|
| `payment_registry` | `CCYAFSGC6VJXGB7PEUOTE3MA2RFEVVNOPWPCZWTIIXHDA2KBC2BFKILZ` |
| `corporate_account` | `CDJZRXQOI7YJAITMT5PCPZ3YML33BOLH4BMVRW5AO27C73EOIKLXNXPA` |
| ed25519 verifier | `CB4E7WQT5F4QIXSGD6KIQQ767PR5YHKPUKRVSOA23A37744LHD4U5LAP` |
| threshold policy (2-of-3) | `CAVNQICYSCB3OYESODZUIAP5VMU7JNIHELIX4HMTTGX5BDRY4LW7BINO` |
| spending-limit policy (5 USDC/period) | `CCCLVKYNKT3W4H3VAANQ6TP6JPZFB4LLJ4IFC5X5ETPA7I6XPB764LWL` |
| USDC SAC (self-issued testnet) | `CACRX5HSM6STJ3GH7CCCWUMI636E2ZH4FPWD7UAWJOIOMD3GJRGY4GNF` |

### Proof transactions

- **Gasless 2-of-3 multisig USDC transfer (3 USDC):**
  `6c6beb30a532bc18015b40131f0b3e65df3306d0931ad5d3ae35bbc9a3113dc2`
  — `from` = corporate_account, `to` = merchant, **fee paid by the
  admin/facilitator** (the corporate account holds no XLM → gasless), 2-of-3
  ed25519 multisig auth via the OZ `AuthPayload`, under the 5 USDC limit.
- **Registry record of that payment:**
  `c7700769e026b0ec91eff6226ad0799cb8fe6c5c9044ac30ed191a4e50124d54`
  — verified `payment_count = 2`, `total_paid(corp) = 3 USDC`.
- **Negative — duplicate record:** re-recording the same settlement reference is
  rejected with `4 AlreadyRecorded` (dedup guard); `payment_count` stayed `2` and
  `total_paid(corp)` stayed 3 USDC, so a recorder retry cannot inflate the trail.
- **Negative — over limit:** 6 USDC transfer rejected with
  `3221 SpendingLimitExceeded`.
- **Negative — under threshold:** 1 signer rejected with `3202 threshold not met`.

Full record: `contracts-stellar/deployments/testnet.json`.

### How the gasless multisig is signed (harness)

`contracts-stellar/harness/transfer.mjs` reproduces the slice:

1. simulate the transfer → get the corporate `SorobanAuthorizationEntry`;
2. build `HashIdPreimage.SorobanAuthorization`, sha256 → `signature_payload`;
3. `auth_digest = sha256(signature_payload || xdr(context_rule_ids=[0]))`;
4. each ed25519 employee signs `auth_digest`; build the OZ `AuthPayload`
   (`Map<Signer, Bytes>`, keys sorted by pubkey);
5. set it as the entry signature, re-simulate **with** signed auth (so resources
   include verify+enforce cost), assemble, and the **admin/facilitator signs and
   pays** the fee → the corporate account stays gasless.

```bash
export ADMIN_SECRET=$(stellar keys secret payroute-admin)
AMOUNT=30000000 NSIG=2 node transfer.mjs   # 3 USDC, 2 signers -> SUCCESS
AMOUNT=60000000 NSIG=2 node transfer.mjs   # 6 USDC          -> 3221 SpendingLimitExceeded
AMOUNT=10000000 NSIG=1 node transfer.mjs   # 1 signer        -> 3202 threshold not met
```

---

## 6. Roadmap (future additions)

These are **not** part of the current testnet milestone; they are the next phases:

1. **Mainnet + real Circle USDC** — repin from the self-issued testnet SAC to
   mainnet Circle USDC and deploy the stack on Stellar mainnet.
2. **Production facilitator** — integrate the real OpenZeppelin Relayer x402
   facilitator (testnet currently uses an admin key as the fee-payer to simulate
   the fee-bump).
3. **Frontend dashboard on Stellar** — wire the existing Next.js dashboard to read
   the registry (`payment_count`, `total_paid`, `PaymentRecorded` events) instead
   of the EVM data, and drive payments through the Soroban corporate account.
4. **Agent Marketplace** — the multi-agent payment feature specified in
   `AGENT_MARKETPLACE_SPEC.md`: pay one or many agents (single / batch / pipeline)
   from the corporate account in a single approved, gasless flow.
5. **Hardening** — full end-to-end unit tests for `corporate_account`
   (currently `#[ignore]` pending the deployed verifier/policy fixtures), security
   review, employee onboarding/offboarding via `batch_add_signer`.

---

## 7. Repository layout

```
contracts-stellar/
├── Cargo.toml                       # workspace, pinned OZ versions
├── README.md                        # architecture summary
├── DOCUMENTATION.md                 # this file
├── contracts/
│   ├── corporate_account/           # smart account: multisig + spending limit
│   └── payment_registry/            # off-path audit trail
├── deployments/testnet.json         # deployed IDs + proof tx hashes
└── harness/                         # testnet reproduction (signing + transfer)
    ├── transfer.mjs                 # builds/signs AuthPayload, gasless submit
    ├── addresses.json               # deployed contract IDs + keys
    └── README.md                    # AuthPayload signing recipe
```
