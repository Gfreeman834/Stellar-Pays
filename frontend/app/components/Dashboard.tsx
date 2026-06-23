"use client";

import { useCallback, useEffect, useState } from "react";
import { explorerTx, formatUsdc } from "@/lib/deployment";
import { AddrLink, Badge, Card, Stat, shorten } from "./ui";

interface PaymentEvent {
  ledger: number;
  txHash: string;
  payer: string;
  payerKind?: "contract" | "account";
  merchant: string;
  token: string;
  amount: string;
  reference: string;
}

interface RegistryData {
  fetchedAt: string;
  count: number;
  totalCorp: string;
  recorder: string;
  corpBalance: string;
  merchantBalance: string;
  symbol: string;
  events: PaymentEvent[];
  eventsSource?: "rpc" | "deployment";
  errors: string[];
}

export default function Dashboard() {
  const [data, setData] = useState<RegistryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/registry", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge tone="ok">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live · Testnet
          </Badge>
          {data && (
            <span className="text-xs text-slate-500">
              updated {new Date(data.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-edge bg-panel px-3 py-1.5 text-xs text-slate-300 hover:border-brand hover:text-white transition"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <Card className="border-bad/40 p-4 text-sm text-red-300">
          Failed to read registry: {error}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Payments recorded"
          value={data ? data.count : "—"}
          sub="payment_count()"
          accent="text-white"
        />
        <Stat
          label="Total paid · corporate"
          value={data ? formatUsdc(data.totalCorp) : "—"}
          sub={`${data?.symbol ?? "USDC"} · total_paid(corp)`}
          accent="text-emerald-300"
        />
        <Stat
          label="Treasury balance"
          value={data ? formatUsdc(data.corpBalance) : "—"}
          sub={`${data?.symbol ?? "USDC"} · balance(corporate_account)`}
          accent="text-indigo-300"
        />
        <Stat
          label="Merchant balance"
          value={data ? formatUsdc(data.merchantBalance) : "—"}
          sub={`${data?.symbol ?? "USDC"} · balance(merchant)`}
          accent="text-cyan-300"
        />
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-edge px-5 py-3">
          <h2 className="text-sm font-semibold text-white">PaymentRecorded events</h2>
          <div className="flex items-center gap-2">
            {data?.eventsSource === "deployment" && (
              <Badge tone="warn">recorded · from deployment</Badge>
            )}
            <span className="text-xs text-slate-500">
              {data ? `${data.events.length} shown` : ""}
            </span>
          </div>
        </div>
        {data?.eventsSource === "deployment" && (
          <div className="border-b border-edge px-5 py-2 text-xs text-slate-500">
            Soroban RPC&apos;s event retention window has expired, so these are the
            real recorded settlement transactions from the deployment — every Tx
            link resolves on Stellar Expert.
          </div>
        )}
        {data && data.events.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            No events in the RPC retention window.
            {data.errors.some((e) => e.startsWith("events")) ? (
              <div className="mt-1 text-xs text-slate-600">
                (event query: {data.errors.find((e) => e.startsWith("events"))})
              </div>
            ) : (
              <div className="mt-1 text-xs text-slate-600">
                Soroban RPC only retains recent events; the FAZ 3 proof tx may be
                older than the window. State totals above remain authoritative.
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2 font-medium">Ledger</th>
                  <th className="px-5 py-2 font-medium">Payer</th>
                  <th className="px-5 py-2 font-medium">Merchant</th>
                  <th className="px-5 py-2 font-medium text-right">Amount</th>
                  <th className="px-5 py-2 font-medium">Tx</th>
                </tr>
              </thead>
              <tbody>
                {data?.events.map((ev) => (
                  <tr
                    key={`${ev.txHash}-${ev.ledger}`}
                    className="border-t border-edge/60 hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-3 tabular-nums text-slate-400">
                      {ev.ledger || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <AddrLink id={ev.payer} kind={ev.payerKind ?? "contract"} />
                    </td>
                    <td className="px-5 py-3">
                      <AddrLink id={ev.merchant} kind="account" />
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-300">
                      {formatUsdc(ev.amount)} USDC
                    </td>
                    <td className="px-5 py-3">
                      <a
                        href={explorerTx(ev.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                        title={ev.txHash}
                      >
                        {shorten(ev.txHash, 6, 4)}
                      </a>
                    </td>
                  </tr>
                ))}
                {!data &&
                  [0, 1, 2].map((i) => (
                    <tr key={i} className="border-t border-edge/60">
                      <td className="px-5 py-3" colSpan={5}>
                        <div className="h-4 w-full animate-pulse rounded bg-edge/60" />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
