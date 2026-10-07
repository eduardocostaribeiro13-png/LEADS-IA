import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  loading?: boolean;
  className?: string;
}

export function KpiCard({ label, value, hint, icon: Icon, loading, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        "rise rounded-2xl border border-edge bg-card px-5 py-4 transition-colors hover:border-ice/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="label-mono text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-4 text-ice" aria-hidden="true" />}
      </div>
      {loading ? (
        <div className="mt-3 h-7 w-20 animate-pulse rounded bg-soft" />
      ) : (
        <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
