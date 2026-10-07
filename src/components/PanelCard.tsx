import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PanelCardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function PanelCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: PanelCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-edge bg-panel shadow-[0_1px_0_0_var(--soft)_inset]",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
