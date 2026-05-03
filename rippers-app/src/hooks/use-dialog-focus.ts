"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function isVisible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (!isVisible(el)) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return true;
  });
}

/**
 * When `open` is true: moves focus into the dialog (prefers `[data-dialog-initial-focus]`),
 * traps Tab within `containerRef`, restores focus to the previously focused element on close.
 */
export function useDialogFocus(open: boolean, containerRef: RefObject<HTMLElement | null>): void {
  const prevActive = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    prevActive.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = containerRef.current;
    if (!root) return;
    const preferred = root.querySelector<HTMLElement>("[data-dialog-initial-focus]");
    const first = preferred ?? focusablesIn(root)[0];
    requestAnimationFrame(() => {
      first?.focus({ preventScroll: true });
    });
    return () => {
      prevActive.current?.focus?.({ preventScroll: true });
      prevActive.current = null;
    };
  }, [open, containerRef]);

  useLayoutEffect(() => {
    if (!open) return;
    const root = containerRef.current;
    if (!root) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const el = containerRef.current;
      if (!el) return;
      const nodes = focusablesIn(el);
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || (active instanceof Node && !el.contains(active))) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || (active instanceof Node && !el.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [open, containerRef]);
}
