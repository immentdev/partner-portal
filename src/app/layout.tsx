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
        {children}
      </body>
    </html>
  );
}
