"use client";
import { useEffect, useState } from "react";

// Lets anyone verify what's actually running matches a specific commit,
// instead of taking a claim on faith.
export function VersionFooter() {
  const [info, setInfo] = useState<{ commit: string; committedAt: string | null } | null>(null);
  useEffect(() => {
    fetch("/api/version").then((r) => r.json()).then(setInfo).catch(() => {});
  }, []);
  if (!info) return null;
  return (
    <div className="py-6 text-center text-[11px] text-black/25">
      commit {info.commit}
      {info.committedAt && ` · ${new Date(info.committedAt).toLocaleString()}`}
    </div>
  );
}
