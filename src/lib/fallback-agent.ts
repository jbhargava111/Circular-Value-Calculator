/** Clearly-labelled rule-based fallback analyst. Executes the real tools, uses templates for prose. */
import { fmtMoney, fmtPct, fmtNum, FIELD_LABELS, type ProgramInputs, type ScenarioAdjustments, type ProgramEconomics, type EnvironmentalImpact, type SensitivityResult, type CircularityMetrics, type ScenarioComparison } from "./calc";
import { runTool, type ToolLogEntry, type ToolName } from "./agent-tools";

export function runFallbackAnalyst(question: string, p: ProgramInputs, scenarios: ScenarioAdjustments[]): { reply: string; log: ToolLogEntry[] } {
  const log: ToolLogEntry[] = [];
  const call = <T,>(name: ToolName): T => {
    const output = runTool(name, p, scenarios);
    log.push({ tool: name, input: { overrides: null, program: p.name }, output, at: new Date().toISOString() });
    return output as T;
  };
  const q = question.toLowerCase();
  const cur = p.currency;

  if (/memo/.test(q)) return { reply: call<{ text: string }>("generateDecisionMemo").text, log };
  if (/proposition|pitch|partner.*(value|summary)/.test(q)) return { reply: call<{ text: string }>("generatePartnerValueProposition").text, log };

  if (/carbon|co2|emission|environment|climate|water|green/.test(q)) {
    const env = call<EnvironmentalImpact>("calculateEnvironmentalImpact");
    if (env.status !== "calculated")
      return { reply: `**Environmental impact: insufficient data.** I can't claim any carbon, water or other environmental savings for this program.\n\nMissing:\n${env.missing.map((m) => `- ${m}`).join("\n")}\n\nHow to obtain: request a product LCA / environmental declaration from the OEM, or use a recognised database, and agree a documented substitution-rate methodology with the partner.`, log };
    return { reply: `Estimated gross avoided manufacturing emissions: **${fmtNum(env.grossAvoidedKgCO2e)} kg CO2e**; net after processing/transport: ${env.netAvoidedKgCO2e !== null ? fmtNum(env.netAvoidedKgCO2e) + " kg CO2e" : "insufficient data"}.\nSource: ${env.source} (${env.date}). ${env.baseline}`, log };
  }

  const v = call<{ issues: { severity: string; message: string }[] }>("validateProgramInputs");
  const e = call<Omit<ProgramEconomics, "formulas">>("calculateProgramEconomics");
  if (!e.complete) {
    return { reply: `I can't calculate program contribution yet.\n\n${e.missing.length ? `Please provide:\n${e.missing.map((m) => `- ${FIELD_LABELS[m]}`).join("\n")}` : ""}\n${v.issues.filter((i) => i.severity === "error").map((i) => `- ⚠ ${i.message}`).join("\n")}`, log };
  }

  if (/risk|driver|sensitiv|cost/.test(q)) {
    const s = call<SensitivityResult>("runSensitivityAnalysis");
    const top = s.rows.slice(0, 3);
    const biggestCost = Object.entries(e.costs).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]!;
    return { reply: `**Biggest drivers of contribution (±${s.changePct}%):**\n${top.map((r) => `- ${r.variable}: swing ${fmtMoney(r.swing, cur)}`).join("\n")}\n\nLargest cost line: **${biggestCost[0]}** at ${fmtMoney(biggestCost[1], cur)} of ${fmtMoney(e.totalCosts, cur)} total.\n${v.issues.filter((i) => i.severity === "warning").map((i) => `- ⚠ ${i.message}`).join("\n")}`, log };
  }
  if (/scenario|upside|conservative|compare/.test(q)) {
    const c = call<ScenarioComparison>("compareProgramScenarios");
    return { reply: `${(c.results as unknown as { label: string; programContribution: number | null; reuseYieldPct: number | null }[]).map((r) => `- **${r.label}**: ${fmtMoney(r.programContribution, cur)}, reuse yield ${fmtPct(r.reuseYieldPct)}`).join("\n")}\n\nLargest driver of the spread: **${c.drivers[0]?.driver}** (${fmtMoney(c.drivers[0]?.contributionSwing ?? null, cur)}).`, log };
  }
  const c = call<CircularityMetrics>("calculateCircularityMetrics");
  return {
    reply: `**Estimated outcome for ${p.name}:**\n- Program contribution: **${fmtMoney(e.programContribution, cur)}** on revenue of ${fmtMoney(e.resaleRevenue, cur)}\n- ${e.split ? `ReUse ${fmtMoney(e.split.reuse.contribution, cur)} · Partner ${fmtMoney(e.split.partner.contribution, cur)}` : "Stakeholder split: commercial terms missing"}\n- Reuse yield ${fmtPct(c.reuseYieldPct)} (${fmtNum(c.devicesReused)} of ${fmtNum(c.devicesCollected)} devices)\n- Break-even resale price ${fmtMoney(e.breakEvenResalePrice, cur)}\n\nMain value source is resale of refurbished devices; ask me about risks, scenarios, a memo or a partner proposition.`,
    log,
  };
}
