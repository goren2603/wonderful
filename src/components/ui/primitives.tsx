import clsx from "clsx";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={clsx("rounded-xl2 border border-black/5 bg-white shadow-card", padded && "p-5", className)}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning" | "talent" | "scout" | "radar";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-black/5 text-black/70",
    positive: "bg-emerald-100 text-emerald-800",
    negative: "bg-rose-100 text-rose-800",
    warning: "bg-amber-100 text-amber-800",
    talent: "bg-talent-soft text-talent",
    scout: "bg-scout-soft text-scout",
    radar: "bg-radar-soft text-radar",
  };
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function ConfidenceBadge({ level }: { level: "LOW" | "MEDIUM" | "HIGH" }) {
  const tone = level === "HIGH" ? "positive" : level === "MEDIUM" ? "warning" : "neutral";
  return <Badge tone={tone}>{level === "HIGH" ? "High confidence" : level === "MEDIUM" ? "Medium confidence" : "Low confidence"}</Badge>;
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black/50">
      Demo data
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  type = "button",
  className,
  accent = "ink",
}: {
  children: ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  accent?: "ink" | "talent" | "scout" | "radar";
}) {
  const accentColor = { ink: "#14161c", talent: "#6d5efc", scout: "#0f9d76", radar: "#e8622c" }[accent];
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
  const sizes = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm";
  const variants: Record<string, string> = {
    primary: "text-white shadow-sm hover:opacity-90",
    secondary: "border border-black/10 bg-white text-black/80 hover:bg-black/[0.03]",
    ghost: "text-black/60 hover:bg-black/5",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };
  return (
    <button
      type={type}
      onClick={() => { if(onClick) Promise.resolve(onClick()).catch(()=>{}); }}
      disabled={disabled}
      style={variant === "primary" ? { backgroundColor: accentColor } : undefined}
      className={clsx(base, sizes, variants[variant], className)}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, max, colorClass = "bg-ink" }: { value: number; max: number; colorClass?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
      <div className={clsx("h-full rounded-full", colorClass)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ title, detail, icon }: { title: string; detail?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl2 border border-dashed border-black/10 px-6 py-14 text-center">
      {icon}
      <p className="text-sm font-medium text-black/70">{title}</p>
      {detail && <p className="max-w-sm text-sm text-black/45">{detail}</p>}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40">{eyebrow}</p>}
        <h2 className="text-lg font-semibold text-black/90">{title}</h2>
        {detail && <p className="mt-0.5 text-sm text-black/50">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({ label, value, sublabel, accent }: { label: string; value: ReactNode; sublabel?: string; accent?: string }) {
  return (
    <div className="rounded-xl2 border border-black/5 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-black/40">{label}</p>
      <p className="mt-1 text-2xl font-semibold" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {sublabel && <p className="mt-0.5 text-xs text-black/45">{sublabel}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-black/[0.06]", className)} />;
}

export function LiveDot({ active = true }: { active?: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      {active && <span className="pulse-dot absolute inline-flex h-full w-full rounded-full bg-emerald-500" />}
      <span className={clsx("relative inline-flex h-2 w-2 rounded-full", active ? "bg-emerald-500" : "bg-black/20")} />
    </span>
  );
}
