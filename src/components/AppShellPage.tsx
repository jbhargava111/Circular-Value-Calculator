import type { ReactNode } from "react";
import { useProgramStore } from "@/lib/store";

/** Waits for saved programs to load from the browser before rendering numbers. */
export function AppShellPage({ children }: { children: ReactNode }) {
  const { ready } = useProgramStore();
  if (!ready) return <div className="py-24 text-center text-sm text-muted-foreground">Loading programs…</div>;
  return <>{children}</>;
}
