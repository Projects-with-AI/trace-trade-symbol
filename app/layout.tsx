import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trace Trade - NSE Stock Tracker",
  description: "Track NSE stocks with buy/sell signals and strict stop-loss",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
