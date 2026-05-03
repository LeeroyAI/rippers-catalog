"use client";

import type { ReactNode } from "react";

import { RiderProfileProvider } from "@/src/state/rider-profile-context";

export default function Providers({ children }: { children: ReactNode }) {
  return <RiderProfileProvider>{children}</RiderProfileProvider>;
}
