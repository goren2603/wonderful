import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppNotice } from "@/components/layout/AppNotice";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Wonderful Intelligence",
  description: "Three autonomous intelligence products for Wonderful — Sourcing Optimizer, Growth Agent, and External Radar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased"><AppNotice />{children}</body>
    </html>
  );
}
