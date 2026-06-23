import { DEPLOYMENT } from "@/lib/deployment";
import Dashboard from "./components/Dashboard";
import { AddrLink, Card } from "./components/ui";

const CONTRACTS: { label: string; id: string; note: string }[] = [
  {
    label: "payment_registry",
    id: DEPLOYMENT.contracts.payment_registry,
    note: "Off-path audit trail · record_payment, total_paid",
  },
  {
    label: "corporate_account",
    id: DEPLOYMENT.contracts.corporate_account,
    note: "Smart account · multisig + spending limit in __check_auth",
  },
  {
    label: "threshold_policy",
    id: DEPLOYMENT.contracts.threshold_policy,
    note: "2-of-3 M-of-N multisig",
  },
  {
    label: "spending_limit_policy",
    id: DEPLOYMENT.contracts.spending_limit_policy,
    note: "5 USDC / period cap",
  },
  {
    label: "ed25519_verifier",
    id: DEPLOYMENT.contracts.ed25519_verifier,
    note: "Validates employee signatures",
  },
  {
    label: "USDC (SEP-41 SAC)",
    id: DEPLOYMENT.usdc_sac,
    note: "Self-issued testnet USDC",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
      <header className="mb-10">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gradient-to-br from-brand to-accent" />
          PayRoute · Soroban
        </div>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Gasless, multisig-gated x402 payments
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          A corporate treasury where every payment clears an{" "}
          <span className="text-slate-200">M-of-N approval</span> and a{" "}
          <span className="text-slate-200">per-period spending limit</span>, the
          payer holds no XLM (the facilitator pays the fee), and every settled
          payment lands in an <span className="text-slate-200">immutable on-chain
          audit registry</span> — while staying compatible with the canonical
          “Built on Stellar” x402 facilitator.
        </p>
      </header>

      <section className="mb-10">
        <Dashboard />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
          Payment path
        </h2>
        <Card className="p-5">
          <pre className="overflow-x-auto whitespace-pre text-xs leading-relaxed text-slate-300">
{`USDC.transfer(from = CorporateAccount, to = merchant, amount)
    │  require_auth(CorporateAccount)
    ▼
CorporateAccount.__check_auth  →  threshold (2-of-3) + spending limit (5 USDC)
    │
    ▼
Facilitator fee-bumps + submits  →  payer holds no XLM (gasless)

── audit path (separate tx) ───────────────────────────────
PayRoute backend → PaymentRegistry.record_payment(payer, merchant, token, amount, txHash)`}
          </pre>
        </Card>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">
          Deployed contracts · {DEPLOYMENT.network} · {DEPLOYMENT.deployed}
        </h2>
        <Card>
          <ul className="divide-y divide-edge/60">
            {CONTRACTS.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-sm font-medium text-white">{c.label}</div>
                  <div className="text-xs text-slate-500">{c.note}</div>
                </div>
                <AddrLink id={c.id} kind="contract" />
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <footer className="mt-12 border-t border-edge/60 pt-6 text-xs text-slate-600">
        <p>
          Reads live state from Soroban testnet RPC ({DEPLOYMENT.rpc}). Network
          passphrase: {DEPLOYMENT.passphrase}. Read-only dashboard — no keys, no
          signing.
        </p>
      </footer>
    </main>
  );
}
