# PayRoute on Stellar - Soroban contracts

Gasless, multisig-gated x402 payments. This workspace is the Stellar port of the
EVM PayRoute contracts (`../contracts`). It is a skeleton (FAZ 2); the live
vertical slice (deploy + first real testnet payment) is FAZ 3.

## Architecture (why the router is off-path)

The canonical "Built on Stellar" x402 facilitator (OpenZeppelin Relayer plugin)
only settles a **direct SEP-41 `transfer`** from the payer and explicitly
rejects sub-invocations and a facilitator appearing in the auth tree. So a
payment cannot be routed through a wrapper contract during settlement.

PayRoute therefore splits responsibilities:

```
PAYMENT PATH (on-chain, settled by the facilitator)
  USDC.transfer(from = CorporateAccount, to = merchant, amount)
        |  require_auth(CorporateAccount)
        v
  CorporateAccount.__check_auth   ->  multisig threshold + spending-limit policies
        |
        v
  Facilitator fee-bumps + submits  ->  user holds no XLM (gasless)

AUDIT PATH (off-chain trigger, separate tx)
  PayRoute backend -> PaymentRegistry.record_payment(payer, merchant, token, amount, txHash)
```

This keeps the payment a plain SEP-41 transfer (facilitator-compatible) while
still producing an immutable, queryable corporate audit trail.

## Contracts

| Crate | Role | Notes |
|---|---|---|
| `corporate_account` | The payer treasury wallet (smart account). Multisig + spending limit run in `__check_auth`. | Wiring follows the OpenZeppelin `multisig-smart-account` example. |
| `payment_registry` | Off-path audit + merchant registry. Recorder-authorized `record_payment`. | Self-contained; no external deps. |

The corporate account composes three reusable OpenZeppelin contracts, deployed
once and referenced by address: an **ed25519 verifier**, a **threshold policy**
(M-of-N multisig), and a **spending-limit policy** (per-period cap). These come
from `stellar-accounts` / the `multisig-smart-account` example.

## EVM -> Stellar mapping

| EVM (../contracts) | Stellar |
|---|---|
| `CorporateVault.sol` (Safe) | `corporate_account` (OZ smart account: multisig + limits) |
| `PaymentRouter.sol` routePayment in-path | direct SEP-41 transfer + off-path `payment_registry` |
| EIP-3009 `transferWithAuthorization` | Soroban authorization entry on SEP-41 `transfer` |
| ERC-20 USDC | SEP-41 USDC |
| Coinbase facilitator broadcasts | OZ Relayer x402 facilitator fee-bumps + sponsors |

## Pinned versions (verified against the reference repo)

- `soroban-sdk = 26.1.0` (feature `experimental_spec_shaking_v2`)
- `stellar-accounts = 0.7.1`, `stellar-contract-utils = 0.7.1`
- toolchain: `stable`, target `wasm32v1-none`

## Build / test / deploy (FAZ 3 - requires Rust + stellar CLI)

> These steps need the Rust toolchain and the `stellar` CLI installed. Not run
> yet; see the project plan before installing.

```bash
# unit tests
cargo test

# wasm release build (per package)
cargo build --target wasm32v1-none --release --package payroute-corporate-account
cargo build --target wasm32v1-none --release --package payroute-payment-registry

# deploy to testnet (after building the policy/verifier wasms from stellar-accounts)
stellar contract deploy --wasm <path>.wasm --network testnet --source <key>
```

## Status

- [x] FAZ 2: workspace + `corporate_account` wiring + `payment_registry` skeleton + registry tests
- [ ] FAZ 3: deploy verifier/policy/account to testnet, first gasless multisig SEP-41 transfer, record in registry, real tx hash
# Stellar-Pay
# Stellar-Pay
# Stellar-Pay
# Stellar-Pays
