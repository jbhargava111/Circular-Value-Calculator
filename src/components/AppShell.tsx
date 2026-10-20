import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutDashboard, Calculator, GitCompareArrows, Bot, FileText, FlaskConical, FolderOpen, Recycle } from "lucide-react";
import { useProgramStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/calculator", label: "Program calculator", icon: Calculator },
  { to: "/scenarios", label: "Scenarios", icon: GitCompareArrows },
  { to: "/analyst", label: "AI analyst", icon: Bot },
  { to: "/report", label: "Partner report", icon: FileText },
  { to: "/programs", label: "Saved programs", icon: FolderOpen },
  { to: "/tests", label: "Test panel", icon: FlaskConical },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { programs, active, setActiveId } = useProgramStore();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex print:hidden">
        <div className="flex items-center gap-2 px-5 py-6">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"><Recycle className="h-5 w-5" /></div>
          <div>
            <div className="font-display text-lg font-semibold leading-none">ReUse</div>
            <div className="text-xs opacity-70">Circular Value Calculator</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent", path === n.to && "bg-sidebar-accent text-sidebar-primary font-medium")}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-4 text-xs opacity-60">All outputs are estimates, not actual financial results.</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b bg-card px-6 py-3 print:hidden">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Active program</span>
          <select value={active.id} onChange={(e) => setActiveId(e.target.value)} className="h-9 max-w-xs rounded-md border bg-background px-2 text-sm">
            {programs.map((p) => <option key={p.id} value={p.id}>{p.inputs.name}</option>)}
          </select>
          {active.illustrative && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">Illustrative sample data</span>}
          <nav className="flex gap-1 overflow-x-auto md:hidden">
            {NAV.map((n) => <Link key={n.to} to={n.to} className={cn("whitespace-nowrap rounded px-2 py-1 text-xs", path === n.to ? "bg-primary text-primary-foreground" : "bg-muted")}>{n.label}</Link>)}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" | "muted" }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-2 font-mono text-2xl font-semibold", tone === "good" && "text-success", tone === "bad" && "text-destructive", tone === "muted" && "text-muted-foreground")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Panel({ title, children, className, right }: { title?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={cn("rounded-lg border bg-card p-5", className)}>
      {title && <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold">{title}</h2>{right}</div>}
      {children}
    </section>
  );
}
