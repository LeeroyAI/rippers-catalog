import type { ReactNode } from "react";

/**
 * One empty-state pattern: icon + message + (optional) action. Replaces the
 * ad-hoc "No items." blocks so every empty screen reads with the same warmth.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-2xl border border-dashed border-stroke bg-surface px-6 py-10 text-center ${className}`}
    >
      {icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand-text">
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] font-semibold text-text">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-text-3">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
