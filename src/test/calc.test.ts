import { describe, expect, it } from "vitest";
import { calculateEnvironmentalImpact, calculateProgramEconomics } from "@/lib/calc";
import { runEvaluations } from "@/lib/eval-cases";
import { SAMPLE_INPUTS } from "@/lib/sample";

describe("calculation engine", () => {
  it("computes the sample program contribution", () => {
    const e = calculateProgramEconomics(SAMPLE_INPUTS);
    expect(e.devicesResold).toBe(6375);
    expect(e.resaleRevenue).toBe(1338750);
    expect(e.totalCosts).toBe(1007250);
    expect(e.programContribution).toBe(331500);
  });
  it("ReUse + partner contributions equal program contribution", () => {
    const e = calculateProgramEconomics(SAMPLE_INPUTS);
    expect(e.split!.reuse.contribution + e.split!.partner.contribution).toBeCloseTo(331500, 6);
  });
  it("never claims environmental savings without sourced factors", () => {
    expect(calculateEnvironmentalImpact(SAMPLE_INPUTS).grossAvoidedKgCO2e).toBeNull();
  });
  it("all evaluation panel cases pass", () => {
    for (const r of runEvaluations()) expect(r.pass, r.name).toBe(true);
  });
});
