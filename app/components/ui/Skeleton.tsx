/**
 * Loading placeholder. Shape it to match the real content it stands in for
 * (pass width/height/rounding via className). Shimmer + entrance respect
 * prefers-reduced-motion via the `.r-skeleton` rule in globals.css.
 */
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`r-skeleton rounded-lg ${className}`} aria-hidden />;
}
