// Mirrors deployments/testnet.json — the live FAZ 3 deployment.
export const DEPLOYMENT = {
  network: "testnet",
  passphrase: "Test SDF Network ; September 2015",
  rpc: "https://soroban-testnet.stellar.org",
  deployed: "2026-06-30",
  contracts: {
    payment_registry: "CCYAFSGC6VJXGB7PEUOTE3MA2RFEVVNOPWPCZWTIIXHDA2KBC2BFKILZ",
    corporate_account: "CDJZRXQOI7YJAITMT5PCPZ3YML33BOLH4BMVRW5AO27C73EOIKLXNXPA",
    ed25519_verifier: "CB4E7WQT5F4QIXSGD6KIQQ767PR5YHKPUKRVSOA23A37744LHD4U5LAP",
    threshold_policy: "CAVNQICYSCB3OYESODZUIAP5VMU7JNIHELIX4HMTTGX5BDRY4LW7BINO",
    spending_limit_policy: "CCCLVKYNKT3W4H3VAANQ6TP6JPZFB4LLJ4IFC5X5ETPA7I6XPB764LWL",
  },
  usdc_sac: "CACRX5HSM6STJ3GH7CCCWUMI636E2ZH4FPWD7UAWJOIOMD3GJRGY4GNF",
  merchant: "GCUD75MLIHRQK3PAT3YAA7ZUXUPV5HBITHB3CO2AKXGPCIDWFA6AH43P",
  admin_facilitator: "GCAJGZOAVUFRZX34JUPMXQMJYEKDKGJW5PDK4VGCYF4GI23UFJWGOGMT",
  usdc_decimals: 7,
} as const;

// The real settled payments recorded on-chain at deployment (FAZ 3 proofs,
// mirrors deployments/testnet.json → proofs). Soroban RPC only retains events
// for a short window, so once the live event query returns nothing we fall back
// to these — every txHash here is a real testnet transaction that resolves on
// Stellar Expert. This is NOT mock data: payment_count() == RECORDED_PAYMENTS.length.
export interface RecordedPayment {
  txHash: string;
  payer: string;
  payerKind: "contract" | "account";
  merchant: string;
  token: string;
  amount: string;
  reference: string;
}

export const RECORDED_PAYMENTS: RecordedPayment[] = [
  {
    // registry_record_v2_corp — the headline gasless 2-of-3 multisig payment.
    txHash: "c7700769e026b0ec91eff6226ad0799cb8fe6c5c9044ac30ed191a4e50124d54",
    payer: "CDJZRXQOI7YJAITMT5PCPZ3YML33BOLH4BMVRW5AO27C73EOIKLXNXPA",
    payerKind: "contract",
    merchant: "GCUD75MLIHRQK3PAT3YAA7ZUXUPV5HBITHB3CO2AKXGPCIDWFA6AH43P",
    token: "CACRX5HSM6STJ3GH7CCCWUMI636E2ZH4FPWD7UAWJOIOMD3GJRGY4GNF",
    amount: "30000000",
    // settlement (gasless transfer) tx the record links back to
    reference: "6c6beb30a532bc18015b40131f0b3e65df3306d0931ad5d3ae35bbc9a3113dc2",
  },
  {
    // registry_record_v1_admin — first recorder smoke-test record.
    txHash: "f110747d066fd255507dbf90d21621fcf64cbbfdcf3cdf0508ff19b88f606a82",
    payer: "GCAJGZOAVUFRZX34JUPMXQMJYEKDKGJW5PDK4VGCYF4GI23UFJWGOGMT",
    payerKind: "account",
    merchant: "GCUD75MLIHRQK3PAT3YAA7ZUXUPV5HBITHB3CO2AKXGPCIDWFA6AH43P",
    token: "CACRX5HSM6STJ3GH7CCCWUMI636E2ZH4FPWD7UAWJOIOMD3GJRGY4GNF",
    amount: "10000000",
    reference: "8f71478a5bf1fc55abe761f2fd0580d5ba620c3a5cba25fb85eb72f634577f95",
  },
];

// Stellar Expert explorer base for testnet.
export const EXPLORER = "https://stellar.expert/explorer/testnet";

export const explorerContract = (id: string) => `${EXPLORER}/contract/${id}`;
export const explorerTx = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const explorerAccount = (g: string) => `${EXPLORER}/account/${g}`;

// USDC amounts are stored as i128 stroops with 7 decimals.
export function formatUsdc(raw: string | bigint): string {
  const v = typeof raw === "bigint" ? raw : BigInt(raw);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const base = 10n ** BigInt(DEPLOYMENT.usdc_decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(DEPLOYMENT.usdc_decimals, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${frac ? "." + frac : ""}`;
}
