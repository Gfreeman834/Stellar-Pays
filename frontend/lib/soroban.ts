import "server-only";
import {
  rpc,
  TransactionBuilder,
  Networks,
  Account,
  Keypair,
  Address,
  Contract,
  scValToNative,
  xdr,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { DEPLOYMENT } from "./deployment";

const server = new rpc.Server(DEPLOYMENT.rpc, { allowHttp: false });
const REGISTRY = DEPLOYMENT.contracts.payment_registry;
const USDC = DEPLOYMENT.usdc_sac;

// A throwaway source account is enough for read-only simulation: we never
// submit, so the account need not exist on-chain. We fabricate a sequence.
function dummySource(): Account {
  return new Account(Keypair.random().publicKey(), "0");
}

// Build, simulate, and decode the return value of a read-only contract call.
async function readCall(method: string, ...args: xdr.ScVal[]): Promise<unknown> {
  return readContractCall(REGISTRY, method, ...args);
}

async function readContractCall(
  contractId: string,
  method: string,
  ...args: xdr.ScVal[]
): Promise<unknown> {
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(dummySource(), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`simulate ${method}: ${sim.error}`);
  }
  const retval = sim.result?.retval;
  if (!retval) throw new Error(`simulate ${method}: empty return`);
  return scValToNative(retval);
}

export async function getPaymentCount(): Promise<number> {
  const v = (await readCall("payment_count")) as number | bigint;
  return Number(v);
}

export async function getTotalPaid(payer: string): Promise<string> {
  const v = (await readCall("total_paid", new Address(payer).toScVal())) as bigint;
  return v.toString();
}

export async function getRecorder(): Promise<string> {
  return (await readCall("recorder")) as string;
}

export async function getAdmin(): Promise<string> {
  return (await readCall("admin")) as string;
}

// SEP-41 token reads against the USDC SAC.
export async function getUsdcBalance(address: string): Promise<string> {
  const v = (await readContractCall(
    USDC,
    "balance",
    new Address(address).toScVal(),
  )) as bigint;
  return v.toString();
}

export async function getUsdcSymbol(): Promise<string> {
  return (await readContractCall(USDC, "symbol")) as string;
}

export interface PaymentEvent {
  ledger: number;
  txHash: string;
  payer: string;
  payerKind: "contract" | "account";
  merchant: string;
  token: string;
  amount: string;
  reference: string;
}

// PaymentRecorded events. The topic[0] is the symbol the SDK derives from the
// #[contractevent] struct name. Events are only retained by the RPC for a
// limited window, so this is best-effort and may return [] for old deployments.
export async function getPaymentEvents(): Promise<PaymentEvent[]> {
  const latest = await server.getLatestLedger();
  // RPC retains roughly the last ~120k ledgers; stay safely inside the window.
  const startLedger = Math.max(latest.sequence - 100_000, 1);

  const res = await server.getEvents({
    startLedger,
    filters: [{ type: "contract", contractIds: [REGISTRY] }],
    limit: 100,
  });

  const out: PaymentEvent[] = [];
  for (const e of res.events ?? []) {
    try {
      const data = scValToNative(e.value) as Record<string, unknown>;
      const topics = (e.topic ?? []).map((t) => {
        try {
          return scValToNative(t);
        } catch {
          return null;
        }
      });
      // topics: [eventName, payer, merchant]; value carries token/amount/reference
      out.push({
        ledger: e.ledger,
        txHash: e.txHash,
        payerKind: "contract",
        payer: (topics[1] as string) ?? (data.payer as string) ?? "",
        merchant: (topics[2] as string) ?? (data.merchant as string) ?? "",
        token: (data.token as string) ?? "",
        amount: data.amount != null ? String(data.amount) : "0",
        reference: bytesToHex(data.reference),
      });
    } catch {
      // skip non-matching / undecodable events
    }
  }
  return out.reverse(); // newest first
}

function bytesToHex(b: unknown): string {
  if (b instanceof Uint8Array) {
    return Array.from(b)
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  }
  return typeof b === "string" ? b : "";
}
