/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import type { Metadata } from "next";
import { Inter_Tight, Syne } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});

export const metadata: Metadata = {
  title: "Partner Portal · BAC × Imment",
  description: "Segnalazioni startup e fee partner per i BAC",
  authors: [{ name: "Giuseppe Pistoia" }],
  robots: { index: false, follow: false },
  other: {
    author: "Giuseppe Pistoia",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <head>
        <meta name="author" content="Giuseppe Pistoia" />
      </head>
      <body
        className={`${interTight.variable} ${syne.variable} font-sans antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <main className="flex-1">{children}</main>
          <footer className="border-t border-trust-dark/10 bg-white/70 px-4 py-3 text-center text-xs text-trust-dark/70">
            Powered by Imment · Progettato e sviluppato da Giuseppe Pistoia · ©
            Imment S.r.l.
          </footer>
        </div>
      </body>
    </html>
  );
}
