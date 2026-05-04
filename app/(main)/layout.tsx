import AppShell from "@/app/components/AppShell";

export default function MainGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="ios-shell-page">{children}</div>
    </AppShell>
  );
}
