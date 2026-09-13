"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function ProductHeader({
  name,
  tagline,
  accentText,
  accentBg,
  right,
}: {
  name: string;
  tagline: string;
  accentText: string;
  accentBg: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-black/40 hover:text-black/70">
        ← Wonderful Intelligence
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className={`inline-block rounded-md ${accentBg} px-2 py-1 text-xs font-semibold ${accentText}`}>{name}</span>
          <p className="mt-2 max-w-xl text-sm text-black/55">{tagline}</p>
        </div>
        {right}
      </div>
    </header>
  );
}
