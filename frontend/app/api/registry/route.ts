import { NextResponse } from "next/server";
import { DEPLOYMENT, RECORDED_PAYMENTS } from "@/lib/deployment";
import {
  getPaymentCount,
  getTotalPaid,
  getRecorder,
  getPaymentEvents,
  getUsdcBalance,
  getUsdcSymbol,
  type PaymentEvent,
} from "@/lib/soroban";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const errors: string[] = [];

  const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      return fallback;
    }
  };

  const [count, totalCorp, recorder, corpBalance, merchantBalance, symbol, events] =
    await Promise.all([
      safe("payment_count", getPaymentCount, 0),
      safe("total_paid(corp)", () => getTotalPaid(DEPLOYMENT.contracts.corporate_account), "0"),
      safe("recorder", getRecorder, ""),
      safe("balance(corp)", () => getUsdcBalance(DEPLOYMENT.contracts.corporate_account), "0"),
      safe("balance(merchant)", () => getUsdcBalance(DEPLOYMENT.merchant), "0"),
      safe("symbol", getUsdcSymbol, "USDC"),
      safe<PaymentEvent[]>("events", getPaymentEvents, []),
    ]);

  // Soroban RPC only retains events for a short window. Once the FAZ 3 proof
  // events age out, the live query returns []. Fall back to the real recorded
  // payments from the deployment so the table still shows on-chain transactions
  // with working explorer links instead of an empty state.
  const usingFallback = events.length === 0 && RECORDED_PAYMENTS.length > 0;
  const outEvents = usingFallback
    ? RECORDED_PAYMENTS.map((p) => ({ ledger: 0, ...p }))
    : events;

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    count,
    totalCorp,
    recorder,
    corpBalance,
    merchantBalance,
    symbol,
    events: outEvents,
    eventsSource: usingFallback ? "deployment" : "rpc",
    errors,
  });
}
