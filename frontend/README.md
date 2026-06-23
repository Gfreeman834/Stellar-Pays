# PayRoute · Frontend (live registry dashboard)

A read-only Next.js dashboard for the PayRoute Stellar deployment (roadmap item
#3 in `../DOCUMENTATION.md`). It reads **live state from Soroban testnet RPC** —
no wallet, no keys, no signing.

## What it shows

- **Payments recorded** — `payment_registry.payment_count()`
- **Total paid (corporate)** — `payment_registry.total_paid(corporate_account)`, USDC (7 dp)
- **Spending policy** — 2-of-3 multisig + 5 USDC/period (from the deployment config)
- **PaymentRecorded events** — best-effort, fetched via Soroban RPC `getEvents`
  within the retention window (older events fall outside it; the state totals
  above stay authoritative)
- **Deployed contracts** — every contract ID, linked to Stellar Expert

State is read by building each read-only call, `simulateTransaction`-ing it
against testnet RPC, and decoding the return value (`scValToNative`). This
happens server-side in `app/api/registry/route.ts` (avoids browser CORS and
keeps `@stellar/stellar-sdk` off the client bundle). The client polls it every
15s.

## Run

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
# or: npm run build && npm run start
```

## Layout

```
frontend/
├── lib/deployment.ts        # contract IDs + USDC formatting (mirrors deployments/testnet.json)
├── lib/soroban.ts           # server-only RPC reads (simulate + decode, getEvents)
├── app/api/registry/route.ts# aggregates count/total/recorder/events into JSON
├── app/page.tsx             # header, architecture diagram, contract registry
└── app/components/
    ├── Dashboard.tsx         # client: live stats + events table, 15s poll
    └── ui.tsx                # Card/Stat/Badge/AddrLink helpers
```

To repin to another deployment (e.g. mainnet), edit `lib/deployment.ts`.
```
