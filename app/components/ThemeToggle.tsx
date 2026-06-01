"use client";

import { useEffect, useState } from "react";

type Mode = "dark" | "light";

function currentMode(): Mode {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

/**
 * Switches between the dark (default) and light token sets by toggling `html.light`,
 * and persists the choice. The flash-prevention script in `layout.tsx` reads the same key.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("dark");

  // Sync from the DOM after mount (the init script may have added `.light` before React ran).
  useEffect(() => {
    setMode(currentMode());
  }, []);

  function toggle() {
    const isLight = document.documentElement.classList.toggle("light");
    const next: Mode = isLight ? "light" : "dark";
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage unavailable — runtime toggle still applies */
    }
    setMode(next);
  }

  const nextLabel = mode === "light" ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={nextLabel}
      title={nextLabel}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stroke bg-surface text-text-2 transition-colors hover:bg-brand/10 hover:text-brand-text ${className}`}
    >
      {mode === "light" ? (
        // Moon — tapping switches to dark
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // Sun — tapping switches to light
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M6 6l-1.4-1.4M19.4 19.4 18 18M18 6l1.4-1.4M4.6 19.4 6 18"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
