import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShellPage } from "@/components/AppShellPage";
import { PageHeader, Panel } from "@/components/AppShell";
import { useProgramStore } from "@/lib/store";
import { compareProgramScenarios, DEFAULT_SCENARIOS, fmtCO2, fmtMoney, fmtNum, fmtPct, type ScenarioAdjustments } from "@/lib/calc";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/scenarios")({
  head: () => ({
    meta: [
      { title: "Scenario comparison — ReUse" },
      { name: "description", content: "Compare conservative, base and upside trade-in scenarios and see which assumptions matter most." },
      { property: "og:title", content: "Scenario comparison — ReUse" },
      { property: "og:description", content: "Side-by-side financial and circularity scenarios for device trade-in programs." },
    ],
  }),
  component: ScenariosPage,
});

const ADJ: { key: keyof ScenarioAdjustments; label: string; step: number }[] = [
  { key: "volumeMultiplier", label: "Volume ×", step: 0.05 },
  { key: "resalePriceMultiplier", label: "Resale price ×", step: 0.05 },
  { key: "eligibleRateDeltaPts", label: "Eligibility ± pts", step: 1 },
  { key: "resoldRateDeltaPts", label: "Resale success ± pts", step: 1 },
  { key: "costMultiplier", label: "Operating costs ×", step: 0.05 },
];

function ScenariosPage() {
  const { active, updateScenarios } = useProgramStore();
  const p = active.inputs;
  const cur = p.currency;
  const cmp = compareProgramScenarios(p, active.scenarios);
  const setAdj = (i: number, k: keyof ScenarioAdjustments, v: number) => updateScenarios(active.scenarios.map((s, n) => (n === i ? { ...s, [k]: v } : s)));
  const chart = cmp.results.map((r) => ({ name: r.label, Revenue: r.economics.resaleRevenue ?? 0, Costs: r.economics.totalCosts ?? 0, Contribution: r.economics.programContribution ?? 0 }));

  return (
    <AppShellPage>
      <PageHeader title="Scenario comparison" subtitle="Each scenario adjusts the base assumptions. Edit adjustments to recalculate." actions={<Button variant="outline" onClick={() => updateScenarios(structuredClone(DEFAULT_SCENARIOS))}>Reset scenarios</Button>} />
      <div className="grid gap-4 md:grid-cols-3">
        {cmp.results.map((r, i) => (
          <Panel key={r.label} title={r.label}>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {ADJ.map((a) => (
                <label key={a.key} className="text-xs text-muted-foreground">{a.label}
                  <input type="number" step={a.step} value={active.scenarios[i]![a.key] as number} onChange={(e) => setAdj(i, a.key, Number(e.target.value))} className="mt-0.5 h-8 w-full rounded border bg-background px-2 font-mono text-sm text-foreground" disabled={r.label === "Base case"} />
                </label>
              ))}
            </div>
            <dl className="space-y-1.5 border-t pt-3 text-sm">
              <R k="Collected" v={fmtNum(r.circularity.devicesCollected)} />
              <R k="Reused" v={fmtNum(r.circularity.devicesReused)} />
              <R k="Reuse yield" v={fmtPct(r.circularity.reuseYieldPct)} />
              <R k="Revenue" v={fmtMoney(r.economics.resaleRevenue, cur)} />
              <R k="Total costs" v={fmtMoney(r.economics.totalCosts, cur)} />
              <R k="Program contribution" v={fmtMoney(r.economics.programContribution, cur)} bold />
              <R k="ReUse" v={fmtMoney(r.economics.split?.reuse.contribution ?? null, cur)} />
              <R k="Partner" v={fmtMoney(r.economics.split?.partner.contribution ?? null, cur)} />
              <R k="Env. impact (net)" v={r.environment.status === "calculated" ? fmtCO2(r.environment.netAvoidedKgCO2e) : "insufficient data"} />
            </dl>
          </Panel>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Financial comparison">
          <div className="h-72"><ResponsiveContainer><BarChart data={chart}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" fontSize={12} /><YAxis tickFormatter={(v) => fmtMoney(v, cur)} fontSize={11} width={90} /><Tooltip formatter={(v: number) => fmtMoney(v, cur)} /><Legend />
            <Bar dataKey="Revenue" fill="var(--chart-3)" /><Bar dataKey="Costs" fill="var(--chart-4)" /><Bar dataKey="Contribution" fill="var(--chart-1)" /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="What drives the difference">
          <p className="mb-3 text-xs text-muted-foreground">Contribution change when moving one assumption from the conservative to the upside setting, all else at base.</p>
          <div className="h-64"><ResponsiveContainer><BarChart data={cmp.drivers.map((d) => ({ name: d.driver, swing: d.contributionSwing ?? 0 }))} layout="vertical" margin={{ left: 30 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" /><XAxis type="number" tickFormatter={(v) => fmtMoney(v, cur)} fontSize={11} /><YAxis type="category" dataKey="name" width={120} fontSize={12} /><Tooltip formatter={(v: number) => fmtMoney(v, cur)} /><Bar dataKey="swing" fill="var(--chart-2)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>
        </Panel>
      </div>
    </AppShellPage>
  );
}

function R({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className={bold ? "font-mono font-semibold" : "font-mono"}>{v}</dd></div>;
}
