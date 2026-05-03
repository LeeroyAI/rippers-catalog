import AppShell from "@/app/components/AppShell";

/** Flex shell so full-bleed map pages fill under the fixed header; children own height / top offset. */
export default function MapGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="r-map-group-shell">{children}</div>
    </AppShell>
  );
}
