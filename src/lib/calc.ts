/**
 * ReUse Circular Value Calculator — deterministic calculation engine.
 * All arithmetic lives here. The AI analyst only calls these functions.
 * Blank inputs are `null` and are NEVER silently treated as zero.
 */

export type PartnerType = "OEM" | "Retailer" | "Other";
export type DeviceCategory = "Smartphones" | "Laptops" | "Tablets" | "Other electronics";
export type Num = number | null;

export interface EnvironmentalFactors {
  /** kg per device */
  deviceWeightKg: Num;
  /** kg CO2e embodied in manufacturing one new equivalent device */
  newDeviceEmbodiedKgCO2e: Num;
  /** % of resold devices assumed to displace a new device purchase */
  substitutionRatePct: Num;
  /** kg CO2e per refurbished device (refurbishment processing) */
  refurbEmissionsKgCO2e: Num;
  /** kg CO2e per collected device (collection & transport) */
  logisticsEmissionsKgCO2e: Num;
  factorSource: string;
  factorDate: string;
  notes: string;
}

export interface ProgramInputs {
  name: string;
  partnerType: PartnerType;
  deviceCategory: DeviceCategory;
  currency: string;
  devicesCollected: Num;
  /** % of collected devices eligible for refurbishment */
  eligibleRatePct: Num;
  /** % of ELIGIBLE devices successfully refurbished and resold */
  resoldRatePct: Num;
  tradeInIncentivePerDevice: Num;
  resalePricePerDevice: Num;
  logisticsCostPerDevice: Num;
  processingCostPerDevice: Num;
  /** applied to each eligible device that enters refurbishment */
  refurbCostPerDevice: Num;
  /** applied to each device not resold */
  recyclingCostPerDevice: Num;
  /** fee per collected device paid by partner to ReUse (transfer) */
  platformFeePerDevice: Num;
  /** % of resale revenue paid to the partner (transfer) */
  partnerRevenueSharePct: Num;
  /** % of the trade-in incentive funded by the partner (rest by ReUse) */
  partnerIncentiveFundingPct: Num;
  fixedCosts: Num;
  env: EnvironmentalFactors;
}

export interface ScenarioAdjustments {
  label: string;
  resalePriceMultiplier: number;
  eligibleRateDeltaPts: number;
  resoldRateDeltaPts: number;
  costMultiplier: number;
  volumeMultiplier: number;
}

export interface ValidationIssue {
  field: string;
  severity: "error" | "warning" | "missing";
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  missingMaterial: string[];
}

export const FIELD_LABELS: Record<string, string> = {
  devicesCollected: "Devices collected",
  eligibleRatePct: "Eligible for refurbishment (%)",
  resoldRatePct: "Refurbished & resold (% of eligible)",
  tradeInIncentivePerDevice: "Trade-in incentive per device",
  resalePricePerDevice: "Resale price per resold device",
  logisticsCostPerDevice: "Collection & logistics cost per device",
  processingCostPerDevice: "Inspection, testing & data-wipe cost per device",
  refurbCostPerDevice: "Refurbishment cost per eligible device",
  recyclingCostPerDevice: "Recycling / disposal cost per non-resold device",
  platformFeePerDevice: "Platform / service fee per collected device",
  partnerRevenueSharePct: "Partner share of resale revenue (%)",
  partnerIncentiveFundingPct: "Partner-funded share of incentive (%)",
  fixedCosts: "Fixed implementation costs",
};

/** Inputs required to compute program-level contribution. */
export const PROGRAM_REQUIRED = [
  "devicesCollected",
  "eligibleRatePct",
  "resoldRatePct",
  "tradeInIncentivePerDevice",
  "resalePricePerDevice",
  "logisticsCostPerDevice",
  "processingCostPerDevice",
  "refurbCostPerDevice",
  "recyclingCostPerDevice",
  "fixedCosts",
] as const;

/** Additional inputs needed to split value between ReUse and the partner. */
export const SPLIT_REQUIRED = [
  "platformFeePerDevice",
  "partnerRevenueSharePct",
  "partnerIncentiveFundingPct",
] as const;

const PCT_FIELDS = [
  "eligibleRatePct",
  "resoldRatePct",
  "partnerRevenueSharePct",
  "partnerIncentiveFundingPct",
] as const;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function validateProgramInputs(p: ProgramInputs): ValidationResult {
  const issues: ValidationIssue[] = [];
  const all = [...PROGRAM_REQUIRED, ...SPLIT_REQUIRED];
  const missingMaterial: string[] = [];

  for (const f of all) {
    const v = p[f];
    if (v === null || v === undefined || (typeof v === "number" && Number.isNaN(v))) {
      if ((PROGRAM_REQUIRED as readonly string[]).includes(f)) missingMaterial.push(f);
      issues.push({
        field: f,
        severity: "missing",
        message: `${FIELD_LABELS[f]} is blank — ${
          (PROGRAM_REQUIRED as readonly string[]).includes(f)
            ? "program contribution cannot be calculated"
            : "stakeholder value split cannot be calculated"
        }.`,
      });
      continue;
    }
    if (v < 0) issues.push({ field: f, severity: "error", message: `${FIELD_LABELS[f]} cannot be negative.` });
  }
  for (const f of PCT_FIELDS) {
    const v = p[f];
    if (isNum(v) && v > 100) issues.push({ field: f, severity: "error", message: `${FIELD_LABELS[f]} cannot exceed 100%.` });
  }
  if (isNum(p.devicesCollected) && !Number.isInteger(p.devicesCollected))
    issues.push({ field: "devicesCollected", severity: "error", message: "Devices collected must be a whole number." });
  if (isNum(p.devicesCollected) && p.devicesCollected === 0)
    issues.push({ field: "devicesCollected", severity: "error", message: "Devices collected must be greater than zero." });

  const unitCost =
    (p.processingCostPerDevice ?? 0) + (p.refurbCostPerDevice ?? 0) + (p.logisticsCostPerDevice ?? 0) + (p.tradeInIncentivePerDevice ?? 0);
  if (isNum(p.resalePricePerDevice) && unitCost > 0 && p.resalePricePerDevice < unitCost)
    issues.push({
      field: "resalePricePerDevice",
      severity: "warning",
      message: "Resale price is below the combined per-device incentive, logistics, processing and refurbishment cost — every resold device loses money before fixed costs.",
    });
  if (isNum(p.resoldRatePct) && isNum(p.eligibleRatePct) && (p.eligibleRatePct * p.resoldRatePct) / 100 < 20)
    issues.push({ field: "resoldRatePct", severity: "warning", message: "Reuse yield is below 20% of collected devices — results are highly sensitive to recovery rates." });

  // Environmental (not required for economics)
  const e = p.env;
  for (const k of ["deviceWeightKg", "newDeviceEmbodiedKgCO2e", "substitutionRatePct", "refurbEmissionsKgCO2e", "logisticsEmissionsKgCO2e"] as const) {
    const v = e[k];
    if (isNum(v) && v < 0) issues.push({ field: `env.${k}`, severity: "error", message: `Environmental factor ${k} cannot be negative.` });
  }
  if (isNum(e.substitutionRatePct) && e.substitutionRatePct > 100)
    issues.push({ field: "env.substitutionRatePct", severity: "error", message: "Substitution rate cannot exceed 100%." });

  return { valid: !issues.some((i) => i.severity === "error"), issues, missingMaterial };
}

export interface CostBreakdown {
  tradeInIncentives: Num;
  logistics: Num;
  processing: Num;
  refurbishment: Num;
  recycling: Num;
  fixed: Num;
}

export interface StakeholderSplit {
  reuse: { revenueRetained: number; platformFeesReceived: number; incentivesFunded: number; operatingCosts: number; contribution: number };
  partner: { revenueShareReceived: number; platformFeesPaid: number; incentivesFunded: number; contribution: number };
}

export interface ProgramEconomics {
  complete: boolean;
  missing: string[];
  devicesCollected: Num;
  devicesEligible: Num;
  devicesResold: Num;
  devicesNotResold: Num;
  resaleRevenue: Num;
  costs: CostBreakdown;
  totalCosts: Num;
  programContribution: Num;
  costPerCollectedDevice: Num;
  contributionPerCollectedDevice: Num;
  contributionPerResoldDevice: Num;
  breakEvenResalePrice: Num;
  split: StakeholderSplit | null;
  splitMissing: string[];
  formulas: { label: string; formula: string }[];
}

const mul = (...xs: Num[]): Num => (xs.every(isNum) ? (xs as number[]).reduce((a, b) => a * b, 1) : null);
const sum = (...xs: Num[]): Num => (xs.every(isNum) ? (xs as number[]).reduce((a, b) => a + b, 0) : null);

export const FORMULAS = [
  { label: "Eligible devices", formula: "collected × eligible %" },
  { label: "Resold devices", formula: "eligible × resold % (of eligible)" },
  { label: "Not resold", formula: "collected − resold" },
  { label: "Resale revenue", formula: "resold × resale price" },
  { label: "Trade-in incentives", formula: "collected × incentive per device" },
  { label: "Logistics", formula: "collected × logistics cost" },
  { label: "Processing", formula: "collected × processing cost" },
  { label: "Refurbishment", formula: "eligible × refurbishment cost" },
  { label: "Recycling", formula: "not resold × recycling cost" },
  { label: "Program contribution", formula: "resale revenue − (incentives + logistics + processing + refurbishment + recycling + fixed)" },
  { label: "Break-even resale price", formula: "total costs ÷ resold devices" },
  { label: "ReUse contribution", formula: "revenue × (1 − partner share) + platform fees − incentives × (1 − partner funding) − operating & fixed costs" },
  { label: "Partner contribution", formula: "revenue × partner share − platform fees − incentives × partner funding" },
];

export function calculateProgramEconomics(p: ProgramInputs): ProgramEconomics {
  const v = validateProgramInputs(p);
  const collected = p.devicesCollected;
  const eligible = mul(collected, isNum(p.eligibleRatePct) ? p.eligibleRatePct / 100 : null);
  const resold = mul(eligible, isNum(p.resoldRatePct) ? p.resoldRatePct / 100 : null);
  const notResold = isNum(collected) && isNum(resold) ? collected - resold : null;
  const revenue = mul(resold, p.resalePricePerDevice);
  const costs: CostBreakdown = {
    tradeInIncentives: mul(collected, p.tradeInIncentivePerDevice),
    logistics: mul(collected, p.logisticsCostPerDevice),
    processing: mul(collected, p.processingCostPerDevice),
    refurbishment: mul(eligible, p.refurbCostPerDevice),
    recycling: mul(notResold, p.recyclingCostPerDevice),
    fixed: p.fixedCosts,
  };
  const totalCosts = sum(costs.tradeInIncentives, costs.logistics, costs.processing, costs.refurbishment, costs.recycling, costs.fixed);
  const contribution = isNum(revenue) && isNum(totalCosts) && v.valid ? revenue - totalCosts : null;
  const complete = contribution !== null;

  let split: StakeholderSplit | null = null;
  const splitMissing = SPLIT_REQUIRED.filter((f) => !isNum(p[f]));
  if (complete && splitMissing.length === 0) {
    const share = p.partnerRevenueSharePct! / 100;
    const fund = p.partnerIncentiveFundingPct! / 100;
    const fees = collected! * p.platformFeePerDevice!;
    const inc = costs.tradeInIncentives!;
    const ops = totalCosts! - inc;
    const reuseC = revenue! * (1 - share) + fees - inc * (1 - fund) - ops;
    const partnerC = revenue! * share - fees - inc * fund;
    split = {
      reuse: { revenueRetained: revenue! * (1 - share), platformFeesReceived: fees, incentivesFunded: inc * (1 - fund), operatingCosts: ops, contribution: reuseC },
      partner: { revenueShareReceived: revenue! * share, platformFeesPaid: fees, incentivesFunded: inc * fund, contribution: partnerC },
    };
  }

  return {
    complete,
    missing: v.missingMaterial,
    devicesCollected: collected,
    devicesEligible: eligible,
    devicesResold: resold,
    devicesNotResold: notResold,
    resaleRevenue: revenue,
    costs,
    totalCosts,
    programContribution: contribution,
    costPerCollectedDevice: isNum(totalCosts) && isNum(collected) && collected > 0 ? totalCosts / collected : null,
    contributionPerCollectedDevice: isNum(contribution) && collected ? contribution / collected : null,
    contributionPerResoldDevice: isNum(contribution) && isNum(resold) && resold > 0 ? contribution / resold : null,
    breakEvenResalePrice: isNum(totalCosts) && isNum(resold) && resold > 0 ? totalCosts / resold : null,
    split,
    splitMissing: [...splitMissing],
    formulas: FORMULAS,
  };
}

export interface CircularityMetrics {
  devicesCollected: Num;
  devicesReused: Num;
  devicesToRecycling: Num;
  reuseYieldPct: Num;
  recyclingPct: Num;
  totalWeightProcessedKg: Num;
  weightReusedKg: Num;
  weightNote: string;
}

export function calculateCircularityMetrics(p: ProgramInputs): CircularityMetrics {
  const e = calculateProgramEconomics(p);
  const c = e.devicesCollected;
  const r = e.devicesResold;
  const w = p.env.deviceWeightKg;
  return {
    devicesCollected: c,
    devicesReused: r,
    devicesToRecycling: e.devicesNotResold,
    reuseYieldPct: isNum(r) && isNum(c) && c > 0 ? (r / c) * 100 : null,
    recyclingPct: isNum(e.devicesNotResold) && isNum(c) && c > 0 ? (e.devicesNotResold / c) * 100 : null,
    totalWeightProcessedKg: mul(c, w),
    weightReusedKg: mul(r, w),
    weightNote: isNum(w) ? `Based on an average device weight of ${w} kg.` : "Device weight not provided — weight metrics unavailable.",
  };
}

export interface EnvironmentalImpact {
  status: "calculated" | "insufficient data";
  missing: string[];
  baseline: string;
  devicesAssumedToDisplaceNew: Num;
  grossAvoidedKgCO2e: Num;
  processingEmissionsKgCO2e: Num;
  netAvoidedKgCO2e: Num;
  netStatus: "calculated" | "insufficient data";
  source: string;
  date: string;
  unit: string;
  assumptions: string[];
}

export const BASELINE_DESCRIPTION =
  "Baseline: without the program, a share of buyers of each refurbished device (the substitution rate) would instead have purchased an equivalent new device. Only that share counts as displaced manufacturing. Devices not resold are not credited with avoided impact.";

export function calculateEnvironmentalImpact(p: ProgramInputs): EnvironmentalImpact {
  const e = p.env;
  const econ = calculateProgramEconomics(p);
  const missing: string[] = [];
  if (!isNum(econ.devicesResold)) missing.push("resold device count (economic inputs)");
  if (!isNum(e.newDeviceEmbodiedKgCO2e)) missing.push("embodied emissions of a new device (kg CO2e)");
  if (!isNum(e.substitutionRatePct)) missing.push("substitution rate (% of resold devices that displace a new purchase)");
  if (!e.factorSource.trim()) missing.push("source of the emissions factor");
  if (!e.factorDate.trim()) missing.push("date of the emissions factor");
  const assumptions = [
    `Substitution rate: ${isNum(e.substitutionRatePct) ? e.substitutionRatePct + "%" : "not provided"}`,
    `New-device embodied emissions: ${isNum(e.newDeviceEmbodiedKgCO2e) ? e.newDeviceEmbodiedKgCO2e + " kg CO2e/device" : "not provided"}`,
    `Refurbishment emissions: ${isNum(e.refurbEmissionsKgCO2e) ? e.refurbEmissionsKgCO2e + " kg CO2e/device" : "not provided"}`,
    `Collection/transport emissions: ${isNum(e.logisticsEmissionsKgCO2e) ? e.logisticsEmissionsKgCO2e + " kg CO2e/device" : "not provided"}`,
  ];
  if (missing.length) {
    return {
      status: "insufficient data", missing, baseline: BASELINE_DESCRIPTION,
      devicesAssumedToDisplaceNew: null, grossAvoidedKgCO2e: null, processingEmissionsKgCO2e: null, netAvoidedKgCO2e: null,
      netStatus: "insufficient data", source: e.factorSource, date: e.factorDate, unit: "kg CO2e", assumptions,
    };
  }
  const displaced = econ.devicesResold! * (e.substitutionRatePct! / 100);
  const gross = displaced * e.newDeviceEmbodiedKgCO2e!;
  const netOk = isNum(e.refurbEmissionsKgCO2e) && isNum(e.logisticsEmissionsKgCO2e);
  const proc = netOk ? econ.devicesEligible! * e.refurbEmissionsKgCO2e! + econ.devicesCollected! * e.logisticsEmissionsKgCO2e! : null;
  return {
    status: "calculated", missing: [], baseline: BASELINE_DESCRIPTION,
    devicesAssumedToDisplaceNew: displaced, grossAvoidedKgCO2e: gross, processingEmissionsKgCO2e: proc,
    netAvoidedKgCO2e: proc !== null ? gross - proc : null,
    netStatus: netOk ? "calculated" : "insufficient data",
    source: e.factorSource, date: e.factorDate, unit: "kg CO2e", assumptions,
  };
}

/* ---------------- Scenarios ---------------- */

export const DEFAULT_SCENARIOS: ScenarioAdjustments[] = [
  { label: "Conservative", resalePriceMultiplier: 0.85, eligibleRateDeltaPts: -10, resoldRateDeltaPts: -10, costMultiplier: 1.15, volumeMultiplier: 0.8 },
  { label: "Base case", resalePriceMultiplier: 1, eligibleRateDeltaPts: 0, resoldRateDeltaPts: 0, costMultiplier: 1, volumeMultiplier: 1 },
  { label: "Upside", resalePriceMultiplier: 1.1, eligibleRateDeltaPts: 5, resoldRateDeltaPts: 5, costMultiplier: 0.9, volumeMultiplier: 1.2 },
];

const clampPct = (v: Num, d: number): Num => (isNum(v) ? Math.max(0, Math.min(100, v + d)) : null);
const scale = (v: Num, m: number): Num => (isNum(v) ? v * m : null);

export function applyScenario(p: ProgramInputs, s: ScenarioAdjustments): ProgramInputs {
  return {
    ...p,
    devicesCollected: isNum(p.devicesCollected) ? Math.round(p.devicesCollected * s.volumeMultiplier) : null,
    eligibleRatePct: clampPct(p.eligibleRatePct, s.eligibleRateDeltaPts),
    resoldRatePct: clampPct(p.resoldRatePct, s.resoldRateDeltaPts),
    resalePricePerDevice: scale(p.resalePricePerDevice, s.resalePriceMultiplier),
    logisticsCostPerDevice: scale(p.logisticsCostPerDevice, s.costMultiplier),
    processingCostPerDevice: scale(p.processingCostPerDevice, s.costMultiplier),
    refurbCostPerDevice: scale(p.refurbCostPerDevice, s.costMultiplier),
    recyclingCostPerDevice: scale(p.recyclingCostPerDevice, s.costMultiplier),
  };
}

export interface ScenarioResult {
  label: string;
  adjustments: ScenarioAdjustments;
  economics: ProgramEconomics;
  circularity: CircularityMetrics;
  environment: EnvironmentalImpact;
}

export interface ScenarioComparison {
  results: ScenarioResult[];
  drivers: { driver: string; contributionSwing: Num }[];
}

export function compareProgramScenarios(p: ProgramInputs, scenarios: ScenarioAdjustments[] = DEFAULT_SCENARIOS): ScenarioComparison {
  const results = scenarios.map((s) => {
    const q = applyScenario(p, s);
    return { label: s.label, adjustments: s, economics: calculateProgramEconomics(q), circularity: calculateCircularityMetrics(q), environment: calculateEnvironmentalImpact(q) };
  });
  // Driver attribution: swing between the first (low) and last (high) scenario, one assumption at a time.
  const lo = scenarios[0]!;
  const hi = scenarios[scenarios.length - 1]!;
  const neutral: ScenarioAdjustments = { label: "", resalePriceMultiplier: 1, eligibleRateDeltaPts: 0, resoldRateDeltaPts: 0, costMultiplier: 1, volumeMultiplier: 1 };
  const keys: [keyof ScenarioAdjustments, string][] = [
    ["resalePriceMultiplier", "Resale price"],
    ["eligibleRateDeltaPts", "Eligibility rate"],
    ["resoldRateDeltaPts", "Resale success rate"],
    ["costMultiplier", "Operating costs"],
    ["volumeMultiplier", "Volume"],
  ];
  const drivers = keys
    .map(([k, name]) => {
      const a = calculateProgramEconomics(applyScenario(p, { ...neutral, [k]: lo[k] })).programContribution;
      const b = calculateProgramEconomics(applyScenario(p, { ...neutral, [k]: hi[k] })).programContribution;
      return { driver: name, contributionSwing: isNum(a) && isNum(b) ? b - a : null };
    })
    .sort((x, y) => Math.abs(y.contributionSwing ?? 0) - Math.abs(x.contributionSwing ?? 0));
  return { results, drivers };
}

/* ---------------- Sensitivity ---------------- */

export interface SensitivityRow {
  variable: string;
  field: keyof ProgramInputs;
  low: Num;
  high: Num;
  contributionAtLow: Num;
  contributionAtHigh: Num;
  swing: Num;
}

export interface SensitivityResult {
  baseContribution: Num;
  changePct: number;
  rows: SensitivityRow[];
}

const SENS_FIELDS: [keyof ProgramInputs, string][] = [
  ["devicesCollected", "Volume (devices collected)"],
  ["resalePricePerDevice", "Resale price"],
  ["refurbCostPerDevice", "Refurbishment cost"],
  ["eligibleRatePct", "Eligibility rate"],
  ["resoldRatePct", "Resale success rate"],
  ["tradeInIncentivePerDevice", "Trade-in incentive"],
  ["processingCostPerDevice", "Processing cost"],
  ["logisticsCostPerDevice", "Logistics cost"],
];

export function runSensitivityAnalysis(p: ProgramInputs, changePct = 20): SensitivityResult {
  const base = calculateProgramEconomics(p).programContribution;
  const rows = SENS_FIELDS.map(([f, name]) => {
    const v = p[f] as Num;
    if (!isNum(v)) return { variable: name, field: f, low: null, high: null, contributionAtLow: null, contributionAtHigh: null, swing: null };
    const isPct = f.toString().endsWith("Pct");
    const adj = (m: number) => {
      let x = v * m;
      if (isPct) x = Math.min(100, x);
      if (f === "devicesCollected") x = Math.round(x);
      return x;
    };
    const low = adj(1 - changePct / 100);
    const high = adj(1 + changePct / 100);
    const cl = calculateProgramEconomics({ ...p, [f]: low }).programContribution;
    const ch = calculateProgramEconomics({ ...p, [f]: high }).programContribution;
    return { variable: name, field: f, low, high, contributionAtLow: cl, contributionAtHigh: ch, swing: isNum(cl) && isNum(ch) ? ch - cl : null };
  }).sort((a, b) => Math.abs(b.swing ?? 0) - Math.abs(a.swing ?? 0));
  return { baseContribution: base, changePct, rows };
}

/* ---------------- Formatting & documents ---------------- */

export function fmtMoney(v: Num, currency = "EUR"): string {
  if (!isNum(v)) return "n/a";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}
export function fmtNum(v: Num, digits = 0): string {
  if (!isNum(v)) return "n/a";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
}
export function fmtPct(v: Num, digits = 1): string {
  return isNum(v) ? `${fmtNum(v, digits)}%` : "n/a";
}
export function fmtCO2(kg: Num): string {
  if (!isNum(kg)) return "insufficient data";
  return kg >= 1000 ? `${fmtNum(kg / 1000, 1)} t CO2e` : `${fmtNum(kg, 0)} kg CO2e`;
}

export function generatePartnerValueProposition(p: ProgramInputs): string {
  const e = calculateProgramEconomics(p);
  const c = calculateCircularityMetrics(p);
  const env = calculateEnvironmentalImpact(p);
  const cur = p.currency;
  const lines: string[] = [];
  lines.push(`# ${p.name} — partner value proposition (estimate)`);
  lines.push("");
  lines.push(`_Illustrative estimate prepared by ReUse for a ${p.partnerType.toLowerCase()} partner. Not an actual financial result or commitment._`);
  lines.push("");
  if (!e.complete) {
    lines.push(`**Economics not yet calculable.** Missing inputs: ${e.missing.map((m) => FIELD_LABELS[m] ?? m).join(", ") || "invalid inputs — see validation"}.`);
  } else {
    lines.push(`A trade-in program for ${fmtNum(c.devicesCollected)} ${p.deviceCategory.toLowerCase()} is estimated to give **${fmtNum(c.devicesReused)} devices a second life** (reuse yield ${fmtPct(c.reuseYieldPct)}).`);
    lines.push("");
    lines.push(`- Estimated resale revenue: **${fmtMoney(e.resaleRevenue, cur)}**`);
    lines.push(`- Estimated program contribution (before unmodeled costs): **${fmtMoney(e.programContribution, cur)}**`);
    lines.push(`- Break-even resale price: ${fmtMoney(e.breakEvenResalePrice, cur)} vs assumed ${fmtMoney(p.resalePricePerDevice, cur)}`);
    if (e.split) {
      lines.push(`- Estimated partner contribution: **${fmtMoney(e.split.partner.contribution, cur)}** (revenue share ${fmtMoney(e.split.partner.revenueShareReceived, cur)}, less fees and partner-funded incentives)`);
      lines.push(`- Estimated ReUse contribution: ${fmtMoney(e.split.reuse.contribution, cur)}`);
    } else {
      lines.push(`- Stakeholder split not calculable — missing: ${e.splitMissing.map((m) => FIELD_LABELS[m]).join(", ")}.`);
    }
    if (isNum(e.programContribution) && e.programContribution < 0)
      lines.push(`\n**Note:** at current assumptions the program shows a negative estimated contribution. Commercial terms or cost assumptions need revisiting before this proposition is viable.`);
  }
  lines.push("");
  lines.push(`**Circularity:** ${fmtNum(c.devicesReused)} reused, ${fmtNum(c.devicesToRecycling)} routed to recycling or responsible disposal.`);
  if (env.status === "calculated") {
    lines.push(`**Environmental estimate:** gross avoided manufacturing emissions of ${fmtCO2(env.grossAvoidedKgCO2e)}${env.netAvoidedKgCO2e !== null ? `, net ${fmtCO2(env.netAvoidedKgCO2e)} after processing and transport` : " (net impact: insufficient data)"}. Source: ${env.source} (${env.date}). ${BASELINE_DESCRIPTION}`);
  } else {
    lines.push(`**Environmental impact:** insufficient data — no emissions savings are claimed. Needed: ${env.missing.join("; ")}.`);
  }
  lines.push("");
  lines.push("Customer engagement, brand and retention benefits are not modeled in these figures.");
  return lines.join("\n");
}

export function generateDecisionMemo(p: ProgramInputs, scenarios: ScenarioAdjustments[] = DEFAULT_SCENARIOS): string {
  const v = validateProgramInputs(p);
  const e = calculateProgramEconomics(p);
  const c = calculateCircularityMetrics(p);
  const env = calculateEnvironmentalImpact(p);
  const cmp = compareProgramScenarios(p, scenarios);
  const sens = runSensitivityAnalysis(p);
  const cur = p.currency;
  const L: string[] = [];
  L.push(`# Decision memo — ${p.name}`);
  L.push(`_Estimates only. Generated from the ReUse calculation engine on ${new Date().toISOString().slice(0, 10)}._`);
  L.push("\n## 1. Assumptions");
  L.push(`Partner type: ${p.partnerType}; device category: ${p.deviceCategory}; currency: ${cur}.`);
  for (const [k, label] of Object.entries(FIELD_LABELS)) {
    const val = p[k as keyof ProgramInputs] as Num;
    L.push(`- ${label}: ${isNum(val) ? fmtNum(val, 2) : "**not provided**"}`);
  }
  L.push("\n## 2. Economics");
  if (e.complete) {
    L.push(`- Resale revenue: ${fmtMoney(e.resaleRevenue, cur)}`);
    L.push(`- Total costs: ${fmtMoney(e.totalCosts, cur)} (incentives ${fmtMoney(e.costs.tradeInIncentives, cur)}, logistics ${fmtMoney(e.costs.logistics, cur)}, processing ${fmtMoney(e.costs.processing, cur)}, refurbishment ${fmtMoney(e.costs.refurbishment, cur)}, recycling ${fmtMoney(e.costs.recycling, cur)}, fixed ${fmtMoney(e.costs.fixed, cur)})`);
    L.push(`- Program contribution: ${fmtMoney(e.programContribution, cur)} (${fmtMoney(e.contributionPerCollectedDevice, cur)} per collected device)`);
    L.push(`- Break-even resale price: ${fmtMoney(e.breakEvenResalePrice, cur)}`);
    if (e.split) L.push(`- ReUse: ${fmtMoney(e.split.reuse.contribution, cur)}; Partner: ${fmtMoney(e.split.partner.contribution, cur)}`);
  } else L.push(`Not calculable. Missing: ${e.missing.map((m) => FIELD_LABELS[m]).join(", ") || "see validation errors"}.`);
  L.push("\n## 3. Circularity");
  L.push(`- Collected ${fmtNum(c.devicesCollected)}, reused ${fmtNum(c.devicesReused)} (${fmtPct(c.reuseYieldPct)}), to recycling ${fmtNum(c.devicesToRecycling)}.`);
  L.push(`- Weight processed: ${c.totalWeightProcessedKg !== null ? fmtNum(c.totalWeightProcessedKg) + " kg" : "not available"}.`);
  L.push(`- Environmental: ${env.status === "calculated" ? `gross ${fmtCO2(env.grossAvoidedKgCO2e)}, net ${fmtCO2(env.netAvoidedKgCO2e)} (source: ${env.source}, ${env.date})` : "insufficient data — " + env.missing.join("; ")}.`);
  L.push("\n## 4. Scenarios");
  for (const r of cmp.results) L.push(`- ${r.label}: contribution ${fmtMoney(r.economics.programContribution, cur)}, reuse yield ${fmtPct(r.circularity.reuseYieldPct)}`);
  L.push(`Biggest scenario drivers: ${cmp.drivers.slice(0, 3).map((d) => `${d.driver} (${fmtMoney(d.contributionSwing, cur)})`).join(", ")}.`);
  L.push("\n## 5. Risks");
  const risks: string[] = [];
  if (sens.rows[0]?.swing !== null && sens.rows[0]) risks.push(`Contribution is most sensitive to ${sens.rows[0].variable.toLowerCase()} (±${sens.changePct}% swings ${fmtMoney(sens.rows[0].swing, cur)}).`);
  if (isNum(e.programContribution) && e.programContribution < 0) risks.push("Base case contribution is negative.");
  for (const i of v.issues.filter((x) => x.severity !== "missing")) risks.push(i.message);
  if (env.status !== "calculated") risks.push("No defensible environmental claim can be made yet.");
  L.push(risks.length ? risks.map((r) => `- ${r}`).join("\n") : "- No material risks flagged by validation.");
  L.push("\n## 6. Recommended next steps");
  const steps: string[] = [];
  if (e.missing.length) steps.push(`Obtain missing inputs: ${e.missing.map((m) => FIELD_LABELS[m]).join(", ")}.`);
  if (e.splitMissing.length) steps.push("Agree commercial terms (revenue share, incentive funding, platform fee) with the partner.");
  if (env.status !== "calculated") steps.push("Source device-specific embodied emissions (e.g. manufacturer LCA) and agree a substitution-rate methodology.");
  steps.push("Validate resale price and eligibility assumptions with a pilot batch of collected devices.");
  L.push(steps.map((s) => `- ${s}`).join("\n"));
  return L.join("\n");
}
