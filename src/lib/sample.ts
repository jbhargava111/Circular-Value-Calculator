import { DEFAULT_SCENARIOS, type ProgramInputs, type ScenarioAdjustments } from "./calc";

export interface SavedProgram {
  id: string;
  inputs: ProgramInputs;
  scenarios: ScenarioAdjustments[];
  updatedAt: string;
  illustrative?: boolean;
}

export const emptyEnv = (): ProgramInputs["env"] => ({
  deviceWeightKg: null,
  newDeviceEmbodiedKgCO2e: null,
  substitutionRatePct: null,
  refurbEmissionsKgCO2e: null,
  logisticsEmissionsKgCO2e: null,
  factorSource: "",
  factorDate: "",
  notes: "",
});

/** Fictional, illustrative sample — not real ReUse or partner data. */
export const SAMPLE_INPUTS: ProgramInputs = {
  name: "Northwind Mobile — Smartphone Trade-in Pilot",
  partnerType: "Retailer",
  deviceCategory: "Smartphones",
  currency: "EUR",
  devicesCollected: 10000,
  eligibleRatePct: 75,
  resoldRatePct: 85,
  tradeInIncentivePerDevice: 60,
  resalePricePerDevice: 210,
  logisticsCostPerDevice: 6,
  processingCostPerDevice: 9,
  refurbCostPerDevice: 28,
  recyclingCostPerDevice: 2,
  platformFeePerDevice: 4,
  partnerRevenueSharePct: 15,
  partnerIncentiveFundingPct: 50,
  fixedCosts: 40000,
  env: { ...emptyEnv(), deviceWeightKg: 0.19, notes: "Illustrative weight. Emissions factors intentionally left blank until a sourced LCA value is entered." },
};

export function blankInputs(): ProgramInputs {
  return {
    name: "New trade-in program",
    partnerType: "OEM",
    deviceCategory: "Smartphones",
    currency: "EUR",
    devicesCollected: null,
    eligibleRatePct: null,
    resoldRatePct: null,
    tradeInIncentivePerDevice: null,
    resalePricePerDevice: null,
    logisticsCostPerDevice: null,
    processingCostPerDevice: null,
    refurbCostPerDevice: null,
    recyclingCostPerDevice: null,
    platformFeePerDevice: null,
    partnerRevenueSharePct: null,
    partnerIncentiveFundingPct: null,
    fixedCosts: null,
    env: emptyEnv(),
  };
}

export const sampleProgram = (): SavedProgram => ({
  id: "sample-northwind",
  inputs: structuredClone(SAMPLE_INPUTS),
  scenarios: structuredClone(DEFAULT_SCENARIOS),
  updatedAt: new Date().toISOString(),
  illustrative: true,
});
