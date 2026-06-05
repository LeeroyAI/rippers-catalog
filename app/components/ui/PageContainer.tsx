import type { ReactNode } from "react";

/**
 * Standard page shell. The (main) layout already provides safe-area padding via
 * `.ios-shell-page`, so pages must NOT re-add `ios-shell-page` or bottom padding.
 * This sets the one consistent gutter + top spacing and a width tier:
 *   narrow  — reading / forms (sizing, welcome-style content)
 *   default — single-column screens (profile)
 *   wide    — data-dense screens (compare, watch, results)
 */
type Width = "narrow" | "default" | "wide";

const WIDTHS: Record<Width, string> = {
  narrow: "max-w-2xl",
  default: "max-w-3xl",
  wide: "max-w-[80rem]",
};

export default function PageContainer({
  width = "default",
  className = "",
  children,
}: {
  width?: Width;
  className?: string;
  children: ReactNode;
}) {
  return (
    <main className={`mx-auto w-full ${WIDTHS[width]} px-4 pt-5 md:px-6 md:pt-8 ${className}`}>
      {children}
    </main>
  );
}
