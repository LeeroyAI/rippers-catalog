import type { ReactNode } from "react";

/**
 * One page-title treatment for every screen, so H1 size/weight stops drifting
 * (it ranged from 20px to 28px across pages). The home hero is the only exempt
 * title. `action` renders a trailing control (e.g. a filter button) aligned right.
 */
export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-text-3">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-text md:text-[28px]">{title}</h1>
        {subtitle ? (
          <p className="mt-1.5 max-w-prose text-[14px] leading-relaxed text-text-2">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
