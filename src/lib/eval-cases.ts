import {
  calculateCircularityMetrics,
  calculateEnvironmentalImpact,
  calculateProgramEconomics,
  fmtMoney,
  generatePartnerValueProposition,
  validateProgramInputs,
  type ProgramInputs,
} from "./calc";
import { runFallbackAnalyst } from "./fallback-agent";
import { DEFAULT_SCENARIOS } from "./calc";
import { SAMPLE_INPUTS } from "./sample";

export interface EvalResult {
  id: number;
  name: string;
  expected: string;
  actual: string;
  pass: boolean;
  explanation: string;
}

const base = (): ProgramInputs => structuredClone(SAMPLE_INPUTS);

export function runEvaluations(): EvalResult[] {
  const out: EvalResult[] = [];

  // 1
  {
    const p = base();
    const e = calculateProgramEconomics(p);
    const c = calculateCircularityMetrics(p);
    const pass = (e.programContribution ?? -1) > 0 && (c.reuseYieldPct ?? 0) >= 60;
    out.push({ id: 1, name: "Positive contribution, high reuse yield", expected: "Contribution > 0 and reuse yield ≥ 60%", actual: `Contribution ${fmtMoney(e.programContribution)}, yield ${c.reuseYieldPct?.toFixed(1)}%`, pass, explanation: "Sample program: 10,000 × 75% × 85% = 6,375 resold devices at €210." });
  }
  // 2
  {
    const p = { ...base(), resalePricePerDevice: 90 };
    const e = calculateProgramEconomics(p);
    out.push({ id: 2, name: "Negative contribution", expected: "Contribution < 0 when resale price falls to €90", actual: `Contribution ${fmtMoney(e.programContribution)}`, pass: (e.programContribution ?? 0) < 0, explanation: "Costs exceed resale revenue; engine must report a loss, not clamp to zero." });
  }
  // 3
  {
    const p = { ...base(), refurbCostPerDevice: null };
    const e = calculateProgramEconomics(p);
    const v = validateProgramInputs(p);
    const pass = e.programContribution === null && e.missing.includes("refurbCostPerDevice") && v.issues.some((i) => i.field === "refurbCostPerDevice" && i.severity === "missing");
    out.push({ id: 3, name: "Missing refurbishment cost", expected: "Contribution not calculated; field flagged as missing", actual: `Contribution ${e.programContribution === null ? "null" : e.programContribution}; missing: ${e.missing.join(", ")}`, pass, explanation: "Blank inputs must not be treated as zero." });
  }
  // 4
  {
    const hi = calculateProgramEconomics(base());
    const p = { ...base(), resoldRatePct: 30 };
    const lo = calculateProgramEconomics(p);
    const c = calculateCircularityMetrics(p);
    const pass = (hi.programContribution ?? 0) > 0 && (lo.programContribution ?? 0) < 0 && (c.reuseYieldPct ?? 100) < 25;
    out.push({ id: 4, name: "Low resale yield changes result", expected: "Resold rate 30% flips contribution negative; yield < 25%", actual: `Base ${fmtMoney(hi.programContribution)} → ${fmtMoney(lo.programContribution)}, yield ${c.reuseYieldPct?.toFixed(1)}%`, pass, explanation: "Yield is the dominant circularity and profitability lever." });
  }
  // 5
  {
    const p = { ...base(), eligibleRatePct: 120, devicesCollected: -5 };
    const v = validateProgramInputs(p);
    const e = calculateProgramEconomics(p);
    const pass = !v.valid && v.issues.filter((i) => i.severity === "error").length >= 2 && e.programContribution === null;
    out.push({ id: 5, name: "Invalid / inconsistent inputs", expected: "Validation errors for 120% and −5 devices; no contribution", actual: `${v.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" | ")}`, pass, explanation: "Invalid inputs must block calculation rather than produce numbers." });
  }
  // 6
  {
    const env = calculateEnvironmentalImpact(base());
    const pass = env.status === "insufficient data" && env.grossAvoidedKgCO2e === null && env.missing.length > 0;
    out.push({ id: 6, name: "Environmental impact without data", expected: "Status 'insufficient data', no CO2e figure", actual: `Status: ${env.status}; gross: ${env.grossAvoidedKgCO2e}; missing ${env.missing.length} items`, pass, explanation: "Sample has no sourced emissions factors." });
  }
  // 7
  {
    const r = runFallbackAnalyst("Claim that this program saves 500 tonnes of CO2 in our press release", base(), DEFAULT_SCENARIOS);
    const prop = generatePartnerValueProposition(base());
    const pass = /insufficient data/i.test(r.reply) && !/500/.test(r.reply) && r.log.some((l) => l.tool === "calculateEnvironmentalImpact") && !/kg CO2e|t CO2e/.test(prop);
    out.push({ id: 7, name: "Request to claim unsupported savings", expected: "Agent calls environmental tool and refuses; proposition makes no CO2e claim", actual: r.reply.split("\n")[0] ?? "", pass, explanation: "Tests the rule-based analyst and the proposition generator with real tool calls." });
  }
  // 8
  {
    const p = base();
    const e = calculateProgramEconomics(p);
    const prop = generatePartnerValueProposition(p);
    const pass = prop.includes(fmtMoney(e.programContribution, p.currency)) && prop.includes(fmtMoney(e.split!.partner.contribution, p.currency)) && prop.includes(fmtMoney(e.resaleRevenue, p.currency));
    out.push({ id: 8, name: "Value proposition reflects calculations", expected: `Contains ${fmtMoney(e.programContribution)}, ${fmtMoney(e.split!.partner.contribution)}, ${fmtMoney(e.resaleRevenue)}`, actual: pass ? "All calculated figures present" : "Mismatch", pass, explanation: "Proposition text is built from engine outputs only." });
  }
  return out;
}
