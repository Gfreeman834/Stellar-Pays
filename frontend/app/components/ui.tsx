import { explorerAccount, explorerContract } from "@/lib/deployment";

export function shorten(id: string, head = 6, tail = 6): string {
  if (!id || id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-edge bg-panel/70 backdrop-blur-sm shadow-lg shadow-black/20 ${className}`}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent = "text-white",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

export function AddrLink({
  id,
  kind = "contract",
  label,
}: {
  id: string;
  kind?: "contract" | "account";
  label?: string;
}) {
  if (!id) return <span className="text-slate-600">—</span>;
  const href = kind === "account" ? explorerAccount(id) : explorerContract(id);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={id}
      className="text-accent hover:text-cyan-300 hover:underline underline-offset-2"
    >
      {label ?? shorten(id)}
    </a>
  );
}

export function Badge({
  children,
  tone = "brand",
}: {
  children: React.ReactNode;
  tone?: "brand" | "ok" | "warn" | "bad";
}) {
  const tones: Record<string, string> = {
    brand: "border-brand/40 bg-brand/10 text-indigo-300",
    ok: "border-ok/40 bg-ok/10 text-emerald-300",
    warn: "border-warn/40 bg-warn/10 text-amber-300",
    bad: "border-bad/40 bg-bad/10 text-red-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
