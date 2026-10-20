import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Copy, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { AppShellPage } from "@/components/AppShellPage";
import { PageHeader, Panel } from "@/components/AppShell";
import { useProgramStore } from "@/lib/store";
import { calculateCircularityMetrics, calculateProgramEconomics, fmtMoney, fmtPct } from "@/lib/calc";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/programs")({
  head: () => ({
    meta: [
      { title: "Saved programs — ReUse" },
      { name: "description", content: "Save, revisit, duplicate and edit trade-in program assumptions." },
      { property: "og:title", content: "Saved programs — ReUse" },
      { property: "og:description", content: "Manage saved device trade-in programs and their scenarios." },
    ],
  }),
  component: ProgramsPage,
});

function ProgramsPage() {
  const s = useProgramStore();
  const nav = useNavigate();
  return (
    <AppShellPage>
      <PageHeader title="Saved programs" subtitle="Programs and their scenario assumptions are saved in this browser."
        actions={<div className="flex gap-2"><Button variant="outline" onClick={s.resetSample}><RotateCcw className="h-4 w-4" /> Restore sample</Button><Button onClick={() => { s.createProgram(); void nav({ to: "/calculator" }); }}><Plus className="h-4 w-4" /> New program</Button></div>} />
      <div className="grid gap-4 md:grid-cols-2">
        {s.programs.map((p) => {
          const e = calculateProgramEconomics(p.inputs);
          const c = calculateCircularityMetrics(p.inputs);
          return (
            <Panel key={p.id} className={p.id === s.active.id ? "ring-2 ring-primary" : ""}>
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="font-semibold">{p.inputs.name}</h3><p className="text-xs text-muted-foreground">{p.inputs.partnerType} · {p.inputs.deviceCategory} · updated {new Date(p.updatedAt).toLocaleString()}</p></div>
                {p.illustrative && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">Illustrative</span>}
              </div>
              <div className="mt-3 flex gap-6 text-sm"><span>Contribution <b className="font-mono">{fmtMoney(e.programContribution, p.inputs.currency)}</b></span><span>Yield <b className="font-mono">{fmtPct(c.reuseYieldPct)}</b></span></div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => { s.setActiveId(p.id); void nav({ to: "/calculator" }); }}><Pencil className="h-3.5 w-3.5" /> Open</Button>
                <Button size="sm" variant="outline" onClick={() => s.duplicateProgram(p.id)}><Copy className="h-3.5 w-3.5" /> Duplicate</Button>
                <Button size="sm" variant="ghost" onClick={() => s.deleteProgram(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </Panel>
          );
        })}
      </div>
    </AppShellPage>
  );
}
