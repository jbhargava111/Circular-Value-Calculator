import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShellPage } from "@/components/AppShellPage";
import { PageHeader, Panel, Stat } from "@/components/AppShell";
import { useProgramStore } from "@/lib/store";
import { calculateCircularityMetrics, calculateEnvironmentalImpact, calculateProgramEconomics, FIELD_LABELS, fmtCO2, fmtMoney, fmtNum, fmtPct } from "@/lib/calc";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — ReUse Circular Value Calculator" },
      { name: "description", content: "Dashboard of estimated economics, reuse yield and circularity outcomes for a device trade-in program." },
      { property: "og:title", content: "ReUse Circular Value Calculator — Overview" },
      { property: "og:description", content: "Estimate the business and circular value of electronic device trade-in programs." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { active } = useProgramStore();
  const p = active.inputs;
  const e = calculateProgramEconomics(p);
  const c = calculateCircularityMetrics(p);
  const env = calculateEnvironmentalImpact(p);
  const cur = p.currency;
  const costData = Object.entries(e.costs).map(([k, v]) => ({ name: k.replace(/([A-Z])/g, " $1").toLowerCase(), value: v ?? 0 }));
  const flow = [
    { name: "Reused", value: c.devicesReused ?? 0 },
    { name: "Recycled / not resold", value: c.devicesToRecycling ?? 0 },
  ];
  return (
    <AppShellPage>
      <PageHeader title={p.name} subtitle={`${p.partnerType} partner · ${p.deviceCategory} · all figures are estimates`} actions={<Button asChild><Link to="/calculator">Edit assumptions</Link></Button>} />
      {!e.complete && (
        <div className="mb-6 rounded-lg border border-warning bg-warning/10 p-4 text-sm">
          <strong>Economics incomplete.</strong> Missing: {e.missing.map((m) => FIELD_LABELS[m]).join(", ") || "inputs are invalid — see calculator"}.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Devices collected" value={fmtNum(c.devicesCollected)} />
        <Stat label="Devices reused" value={fmtNum(c.devicesReused)} />
        <Stat label="Reuse yield" value={fmtPct(c.reuseYieldPct)} hint="reused ÷ collected" />
        <Stat label="Est. program contribution" value={fmtMoney(e.programContribution, cur)} tone={e.programContribution === null ? "muted" : e.programContribution >= 0 ? "good" : "bad"} hint="before unmodeled costs" />
        <Stat label="Env. impact (net)" value={env.status === "calculated" ? fmtCO2(env.netAvoidedKgCO2e ?? env.grossAvoidedKgCO2e) : "Insufficient data"} tone={env.status === "calculated" ? "good" : "muted"} hint={env.status === "calculated" ? `source: ${env.source}` : "no sourced factors"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Value by stakeholder" className="lg:col-span-1">
          {e.split ? (
            <dl className="space-y-3 text-sm">
              <Row k="Overall program" v={fmtMoney(e.programContribution, cur)} bold />
              <Row k="Captured by ReUse" v={fmtMoney(e.split.reuse.contribution, cur)} />
              <Row k="Captured by partner" v={fmtMoney(e.split.partner.contribution, cur)} />
              <p className="pt-2 text-xs text-muted-foreground">Fees and revenue share are transfers; ReUse + partner = program.</p>
            </dl>
          ) : <p className="text-sm text-muted-foreground">Split unavailable — {e.complete ? `missing ${e.splitMissing.map((m) => FIELD_LABELS[m]).join(", ")}` : "economics incomplete"}.</p>}
        </Panel>
        <Panel title="Cost breakdown" className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={costData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tickFormatter={(v) => fmtMoney(v, cur)} fontSize={11} />
                <YAxis type="category" dataKey="name" width={110} fontSize={12} />
                <Tooltip formatter={(v: number) => fmtMoney(v, cur)} />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Device pathways">
          <div className="h-48">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={flow} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                  <Cell fill="var(--chart-2)" /><Cell fill="var(--chart-3)" />
                </Pie>
                <Tooltip formatter={(v: number) => fmtNum(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-around text-xs"><span>● Reused {fmtNum(c.devicesReused)}</span><span>● Recycled {fmtNum(c.devicesToRecycling)}</span></div>
        </Panel>
        <Panel title="Circularity dashboard" className="lg:col-span-2">
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <Row k="Collected" v={fmtNum(c.devicesCollected)} />
            <Row k="Reused (second life)" v={`${fmtNum(c.devicesReused)} (${fmtPct(c.reuseYieldPct)})`} />
            <Row k="Recycling / other end-of-life" v={`${fmtNum(c.devicesToRecycling)} (${fmtPct(c.recyclingPct)})`} />
            <Row k="Weight processed" v={c.totalWeightProcessedKg !== null ? `${fmtNum(c.totalWeightProcessedKg)} kg` : "not provided"} />
            <Row k="Weight reused" v={c.weightReusedKg !== null ? `${fmtNum(c.weightReusedKg)} kg` : "not provided"} />
            <Row k="Avoided emissions (gross)" v={fmtCO2(env.grossAvoidedKgCO2e)} />
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">{env.baseline}</p>
          {env.status !== "calculated" && <p className="mt-2 text-xs text-muted-foreground">Environmental impact: <strong>insufficient data</strong> — needs {env.missing.join("; ")}.</p>}
        </Panel>
      </div>
    </AppShellPage>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className="flex justify-between gap-4 border-b border-dashed pb-2"><dt className="text-muted-foreground">{k}</dt><dd className={bold ? "font-mono font-semibold" : "font-mono"}>{v}</dd></div>;
}
