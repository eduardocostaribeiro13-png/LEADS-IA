import { cn } from "@/lib/utils";
import { tierForScore } from "@/lib/score";

export interface ScoreDialProps {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { box: "size-11", text: "text-xs" },
  md: { box: "size-14", text: "text-sm" },
  lg: { box: "size-24", text: "text-2xl" },
} as const;

export function ScoreDial({ score, size = "md", className }: ScoreDialProps) {
  const tier = tierForScore(score);
  const dimensions = SIZES[size];
  const offset = 150 - (Math.max(0, Math.min(100, score)) / 100) * 137;

  return (
    <div className={cn("relative shrink-0", dimensions.box, className)}>
      <svg viewBox="0 0 60 60" className={cn("-rotate-90", dimensions.box)} aria-hidden="true">
        <circle cx="30" cy="30" r="24" fill="none" strokeWidth="6" className="dial-track" />
        <circle
          cx="30"
          cy="30"
          r="24"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          pathLength={150}
          style={{ strokeDashoffset: offset }}
          className={cn("dial-value", tier.strokeClassName)}
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 grid place-items-center font-mono font-semibold text-foreground",
          dimensions.text,
        )}
      >
        {score}
      </span>
    </div>
  );
}
