/** Tool registry shared by the AI analyst (server) and the rule-based fallback (browser). */
import {
  calculateCircularityMetrics,
  calculateEnvironmentalImpact,
  calculateProgramEconomics,
  compareProgramScenarios,
  generateDecisionMemo,
  generatePartnerValueProposition,
  runSensitivityAnalysis,
  validateProgramInputs,
  type ProgramInputs,
  type ScenarioAdjustments,
} from "./calc";

export interface WhatIfOverrides {
  devicesCollected: number | null;
  eligibleRatePct: number | null;
  resoldRatePct: number | null;
  resalePricePerDevice: number | null;
  refurbCostPerDevice: number | null;
  tradeInIncentivePerDevice: number | null;
}

export type ToolName =
  | "validateProgramInputs"
  | "calculateProgramEconomics"
  | "calculateCircularityMetrics"
  | "calculateEnvironmentalImpact"
  | "compareProgramScenarios"
  | "runSensitivityAnalysis"
  | "generatePartnerValueProposition"
  | "generateDecisionMemo";

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  validateProgramInputs: "Validate the program inputs; returns errors, warnings and missing material inputs.",
  calculateProgramEconomics: "Compute devices, revenue, cost breakdown, program contribution, per-device figures, break-even resale price and the ReUse/partner split.",
  calculateCircularityMetrics: "Compute devices collected/reused/recycled, reuse yield and weight processed.",
  calculateEnvironmentalImpact: "Compute avoided emissions ONLY if sourced factors exist; otherwise returns status 'insufficient data'.",
  compareProgramScenarios: "Compare conservative, base and upside scenarios and rank the assumptions driving the difference.",
  runSensitivityAnalysis: "Vary each key input ±20% and rank by effect on program contribution.",
  generatePartnerValueProposition: "Produce a partner-facing value proposition text built strictly from calculated outputs.",
  generateDecisionMemo: "Produce a decision memo with assumptions, economics, circularity, risks and next steps.",
};

export function applyOverrides(p: ProgramInputs, o?: Partial<WhatIfOverrides> | null): ProgramInputs {
  if (!o) return p;
  const q = { ...p };
  for (const [k, v] of Object.entries(o)) if (typeof v === "number") (q as Record<string, unknown>)[k] = v;
  return q;
}

export function runTool(name: ToolName, p: ProgramInputs, scenarios: ScenarioAdjustments[], overrides?: Partial<WhatIfOverrides> | null): unknown {
  const q = applyOverrides(p, overrides);
  switch (name) {
    case "validateProgramInputs": return validateProgramInputs(q);
    case "calculateProgramEconomics": { const { formulas: _f, ...rest } = calculateProgramEconomics(q); return rest; }
    case "calculateCircularityMetrics": return calculateCircularityMetrics(q);
    case "calculateEnvironmentalImpact": return calculateEnvironmentalImpact(q);
    case "compareProgramScenarios": {
      const c = compareProgramScenarios(q, scenarios);
      return {
        drivers: c.drivers,
        results: c.results.map((r) => ({ label: r.label, adjustments: r.adjustments, programContribution: r.economics.programContribution, resaleRevenue: r.economics.resaleRevenue, totalCosts: r.economics.totalCosts, reuseYieldPct: r.circularity.reuseYieldPct, devicesReused: r.circularity.devicesReused, split: r.economics.split ? { reuse: r.economics.split.reuse.contribution, partner: r.economics.split.partner.contribution } : null })),
      };
    }
    case "runSensitivityAnalysis": return runSensitivityAnalysis(q);
    case "generatePartnerValueProposition": return { text: generatePartnerValueProposition(q) };
    case "generateDecisionMemo": return { text: generateDecisionMemo(q, scenarios) };
  }
}

export interface ToolLogEntry {
  tool: string;
  input: unknown;
  output: unknown;
  at: string;
}
