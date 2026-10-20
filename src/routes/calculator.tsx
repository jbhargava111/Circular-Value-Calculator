import { createFileRoute } from "@tanstack/react-router";
import { AppShellPage } from "@/components/AppShellPage";
import { PageHeader, Panel } from "@/components/AppShell";
import { useProgramStore } from "@/lib/store";
import { calculateEnvironmentalImpact, calculateProgramEconomics, FIELD_LABELS, fmtMoney, fmtNum, runSensitivityAnalysis, validateProgramInputs, type ProgramInputs, type Num } from "@/lib/calc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: "Program calculator — ReUse" },
      { name: "description", content: "Configure trade-in volumes, recovery rates, costs and commercial terms with live recalculation." },
      { property: "og:title", content: "Program calculator — ReUse" },
      { property: "og:description", content: "Editable assumptions and transparent formulas for device trade-in economics." },
    ],
  }),
  component: CalculatorPage,
});

type NumKey = { [K in keyof ProgramInputs]: ProgramInputs[K] extends Num ? K : never }[keyof ProgramInputs];

const GROUPS: { title: string; fields: { key: NumKey; unit: string }[] }[] = [
  { title: "Volume & recovery", fields: [{ key: "devicesCollected", unit: "devices" }, { key: "eligibleRatePct", unit: "% of collected" }, { key: "resoldRatePct", unit: "% of eligible" }] },
  { title: "Revenue & incentive", fields: [{ key: "resalePricePerDevice", unit: "per resold device" }, { key: "tradeInIncentivePerDevice", unit: "per collected device" }] },
  { title: "Operating costs", fields: [{ key: "logisticsCostPerDevice", unit: "per collected" }, { key: "processingCostPerDevice", unit: "per collected" }, { key: "refurbCostPerDevice", unit: "per eligible" }, { key: "recyclingCostPerDevice", unit: "per non-resold" }, { key: "fixedCosts", unit: "total" }] },
  { title: "Commercial model", fields: [{ key: "platformFeePerDevice", unit: "partner → ReUse, per collected" }, { key: "partnerRevenueSharePct", unit: "% of resale revenue to partner" }, { key: "partnerIncentiveFundingPct", unit: "% of incentive paid by partner" }] },
];

const ENV_FIELDS: { key: keyof ProgramInputs["env"]; label: string; unit: string }[] = [
  { key: "deviceWeightKg", label: "Average device weight", unit: "kg" },
  { key: "newDeviceEmbodiedKgCO2e", label: "Embodied emissions of equivalent new device", unit: "kg CO2e" },
  { key: "substitutionRatePct", label: "Substitution rate", unit: "% of resold displacing new" },
  { key: "refurbEmissionsKgCO2e", label: "Refurbishment emissions", unit: "kg CO2e / eligible device" },
  { key: "logisticsEmissionsKgCO2e", label: "Collection & transport emissions", unit: "kg CO2e / collected device" },
];

const parse = (s: string): Num => (s.trim() === "" ? null : Number(s));

function NumField({ label, unit, value, onChange, issue }: { label: string; unit: string; value: Num; onChange: (v: Num) => void; issue?: { severity: string; message: string } }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input type="number" step="any" value={value ?? ""} placeholder="blank" onChange={(e) => onChange(parse(e.target.value))}
          className={cn("h-9 w-full rounded-md border bg-background px-3 font-mono text-sm", issue?.severity === "error" && "border-destructive", issue?.severity === "missing" && "border-warning bg-warning/5")} />
        <span className="w-36 shrink-0 text-xs text-muted-foreground">{unit}</span>
      </div>
      {issue && <span className={cn("mt-1 block text-xs", issue.severity === "error" ? "text-destructive" : "text-muted-foreground")}>{issue.message}</span>}
    </label>
  );
}

function CalculatorPage() {
  const { active, updateInputs } = useProgramStore();
  const p = active.inputs;
  const v = validateProgramInputs(p);
  const e = calculateProgramEconomics(p);
  const env = calculateEnvironmentalImpact(p);
  const sens = runSensitivityAnalysis(p);
  const cur = p.currency;
  const issueFor = (f: string) => v.issues.find((i) => i.field === f && i.severity !== "warning");
  const set = <K extends keyof ProgramInputs>(k: K, val: ProgramInputs[K]) => updateInputs((x) => ({ ...x, [k]: val }));
  const setEnv = <K extends keyof ProgramInputs["env"]>(k: K, val: ProgramInputs["env"][K]) => updateInputs((x) => ({ ...x, env: { ...x.env, [k]: val } }));

  return (
    <AppShellPage>
      <PageHeader title="Program calculator" subtitle="Changes save automatically and recalculate live. Leave unknown inputs blank — they are flagged, never treated as zero." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Panel title="Program">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2"><span className="text-sm font-medium">Program name</span>
                <input value={p.name} onChange={(ev) => set("name", ev.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" /></label>
              <Sel label="Partner type" value={p.partnerType} options={["OEM", "Retailer", "Other"]} onChange={(x) => set("partnerType", x as ProgramInputs["partnerType"])} />
              <Sel label="Device category" value={p.deviceCategory} options={["Smartphones", "Laptops", "Tablets", "Other electronics"]} onChange={(x) => set("deviceCategory", x as ProgramInputs["deviceCategory"])} />
              <Sel label="Currency" value={p.currency} options={["EUR", "USD", "GBP"]} onChange={(x) => set("currency", x)} />
            </div>
          </Panel>
          {GROUPS.map((g) => (
            <Panel key={g.title} title={g.title}>
              <div className="grid gap-4 sm:grid-cols-2">
                {g.fields.map((f) => <NumField key={f.key} label={FIELD_LABELS[f.key]!} unit={f.unit.startsWith("per") || f.unit === "total" ? `${cur} ${f.unit}` : f.unit} value={p[f.key]} onChange={(x) => set(f.key, x)} issue={issueFor(f.key)} />)}
              </div>
            </Panel>
          ))}
          <Panel title="Environmental factors (optional)">
            <p className="mb-4 text-xs text-muted-foreground">Only enter factors you can source. Without a factor, its source and date, environmental impact is reported as “insufficient data”.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {ENV_FIELDS.map((f) => <NumField key={f.key} label={f.label} unit={f.unit} value={p.env[f.key] as Num} onChange={(x) => setEnv(f.key, x as never)} issue={v.issues.find((i) => i.field === `env.${f.key}`)} />)}
              <label className="block"><span className="text-sm font-medium">Factor source</span><input value={p.env.factorSource} onChange={(ev) => setEnv("factorSource", ev.target.value)} placeholder="e.g. Manufacturer product LCA" className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" /></label>
              <label className="block"><span className="text-sm font-medium">Factor date</span><input value={p.env.factorDate} onChange={(ev) => setEnv("factorDate", ev.target.value)} placeholder="e.g. 2025-06" className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" /></label>
              <label className="block sm:col-span-2"><span className="text-sm font-medium">Assumption notes</span><textarea value={p.env.notes} onChange={(ev) => setEnv("notes", ev.target.value)} className="mt-1 min-h-16 w-full rounded-md border bg-background p-3 text-sm" /></label>
            </div>
          </Panel>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Panel title="Live estimate">
            <dl className="space-y-2 text-sm">
              {[
                ["Eligible devices", fmtNum(e.devicesEligible)],
                ["Resold devices", fmtNum(e.devicesResold)],
                ["Not resold", fmtNum(e.devicesNotResold)],
                ["Resale revenue", fmtMoney(e.resaleRevenue, cur)],
                ["Incentives", fmtMoney(e.costs.tradeInIncentives, cur)],
                ["Logistics", fmtMoney(e.costs.logistics, cur)],
                ["Processing", fmtMoney(e.costs.processing, cur)],
                ["Refurbishment", fmtMoney(e.costs.refurbishment, cur)],
                ["Recycling", fmtMoney(e.costs.recycling, cur)],
                ["Fixed", fmtMoney(e.costs.fixed, cur)],
                ["Total costs", fmtMoney(e.totalCosts, cur)],
              ].map(([k, val]) => <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-mono">{val}</dd></div>)}
              <div className="flex justify-between border-t pt-2 font-semibold"><dt>Program contribution</dt><dd className={cn("font-mono", (e.programContribution ?? 0) < 0 && "text-destructive")}>{fmtMoney(e.programContribution, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Cost / collected device</dt><dd className="font-mono">{fmtMoney(e.costPerCollectedDevice, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Contribution / collected</dt><dd className="font-mono">{fmtMoney(e.contributionPerCollectedDevice, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Contribution / resold</dt><dd className="font-mono">{fmtMoney(e.contributionPerResoldDevice, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Break-even resale price</dt><dd className="font-mono">{fmtMoney(e.breakEvenResalePrice, cur)}</dd></div>
              {e.split && <>
                <div className="flex justify-between border-t pt-2"><dt>ReUse contribution</dt><dd className="font-mono">{fmtMoney(e.split.reuse.contribution, cur)}</dd></div>
                <div className="flex justify-between"><dt>Partner contribution</dt><dd className="font-mono">{fmtMoney(e.split.partner.contribution, cur)}</dd></div>
              </>}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Estimates only. Env. impact: {env.status}.</p>
          </Panel>
          {v.issues.length > 0 && (
            <Panel title={`Validation (${v.issues.length})`}>
              <ul className="space-y-2 text-xs">
                {v.issues.map((i, n) => <li key={n} className="flex gap-2"><span className={cn("rounded px-1.5 py-0.5 font-medium uppercase", i.severity === "error" ? "bg-destructive text-destructive-foreground" : i.severity === "warning" ? "bg-warning/30" : "bg-muted")}>{i.severity}</span><span>{i.message}</span></li>)}
              </ul>
            </Panel>
          )}
          <Panel title="Sensitivity (±20%)">
            <ul className="space-y-1.5 text-xs">
              {sens.rows.map((r) => {
                const max = Math.max(...sens.rows.map((x) => Math.abs(x.swing ?? 0)), 1);
                return <li key={r.variable}><div className="flex justify-between"><span>{r.variable}</span><span className="font-mono">{fmtMoney(r.swing, cur)}</span></div>
                  <div className="mt-0.5 h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${(Math.abs(r.swing ?? 0) / max) * 100}%` }} /></div></li>;
              })}
            </ul>
          </Panel>
          <Panel title="Formulas">
            <ul className="space-y-1.5 text-xs">{e.formulas.map((f) => <li key={f.label}><strong>{f.label}:</strong> <span className="font-mono text-muted-foreground">{f.formula}</span></li>)}</ul>
          </Panel>
        </div>
      </div>
    </AppShellPage>
  );
}

function Sel({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">{options.map((o) => <option key={o}>{o}</option>)}</select></label>;
}
