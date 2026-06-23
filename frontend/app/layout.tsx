import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayRoute · Stellar Registry Dashboard",
  description:
    "Live audit dashboard for PayRoute — gasless, multisig-gated x402 corporate payments on Soroban.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-mono text-slate-200 antialiased">{children}</body>
    </html>
  );
}
