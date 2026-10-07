import { cn } from "@/lib/utils";
import { tierForScore } from "@/lib/score";

export function TierBadge({ score, className }: { score: number; className?: string }) {
  const tier = tierForScore(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        tier.className,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", tier.dotClassName)} aria-hidden="true" />
      {tier.label}
    </span>
  );
}

export function Tag({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "label-mono rounded-md border border-edge bg-soft px-2 py-0.5 text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
