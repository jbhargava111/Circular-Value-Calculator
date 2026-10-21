# Use Circular Value Calculator

**What is this?**

The Circular Value Calculator is a modeling tool for electronics trade-in and refurbishment programs. When a company collects used devices from customers — say, a retailer taking back old smartphones in exchange for a voucher — somebody has to answer hard questions before committing money to the program:

- **Will it make money?** You pay out trade-in incentives, shipping, testing, repairs, and recycling for every device, but only *some* of those devices end up resale-worthy. Does the resale revenue actually cover the costs?
- **Who makes what?** ReUse (the operator running collection and refurbishment) and the commercial partner (OEM or retailer) each bear some costs and earn some revenue. How does the value split between them under the deal terms?
- **What's the environmental claim?** Everyone wants to say "we saved X tonnes of CO₂." What can you *actually* claim with defensible data — and what can't you?
- **What's the risk?** If resale prices drop or fewer devices pass testing, where does the business case break first?

This app answers those questions with transparent, deterministic math. There is a live calculator where you type program assumptions and see results update instantly, a scenario comparison view, a partner-facing report, and an AI analyst you can ask "what-if" questions — with the crucial guarantee that **every number it states comes from the calculation engine, never from the model itself**.

There is no hidden database and no spreadsheet. You enter your program's assumptions, the engine does the arithmetic, and the AI only interprets what the engine computes.

---

## Core principles

1. **Deterministic calculation core (`src/lib/calc.ts`)** — All financial arithmetic, unit economics, sensitivity models, and carbon-impact formulas live in pure, side-effect-free TypeScript functions. The same inputs always produce the same outputs.

2. **Zero-coercion rule (strict `null` semantics)** — A blank input stays `null` and is never silently treated as `0`. If a required parameter is missing, dependent calculations halt and the UI reports exactly which fields are missing. A program with no refurbishment cost entered simply has *no* contribution figure — it is never presented as an estimate with a fake zero baked in.

3. **Zero-hallucination AI** — The AI Circularity Analyst is not allowed to do arithmetic or invent figures. It only dispatches structured tool calls (`src/lib/agent-tools.ts`) against the deterministic engine and synthesizes prose from the returned numbers. Every tool call and its output is shown in the activity log.

---

## 1. Device flow & pipeline yield

Devices travel through a multi-stage funnel:

- **Eligible devices** (pass intake screening):

  $$\text{Devices}_{\text{eligible}} = \text{Devices}_{\text{collected}} \times \frac{\text{Eligible Rate \%}}{100}$$

- **Resold devices** (successfully refurbished and sold):

  $$\text{Devices}_{\text{resold}} = \text{Devices}_{\text{eligible}} \times \frac{\text{Resold Rate \%}}{100}$$

- **Recycled devices** (everything not resold):

  $$\text{Devices}_{\text{recycled}} = \text{Devices}_{\text{collected}} - \text{Devices}_{\text{resold}}$$

- **Reuse yield**:

  $$\text{Yield}_{\text{reuse}} = \frac{\text{Devices}_{\text{resold}}}{\text{Devices}_{\text{collected}}} \times 100$$

---

## 2. Costs, revenue & program contribution

### 2.1 Cost breakdown

| Cost component | Borne on | Formula |
| :--- | :--- | :--- |
| Trade-in incentives | All collected units | $\text{Collected} \times \text{Incentive}_{\text{per device}}$ |
| Logistics & intake | All collected units | $\text{Collected} \times \text{Logistics}_{\text{per device}}$ |
| Testing & data-wipe | All collected units | $\text{Collected} \times \text{Processing}_{\text{per device}}$ |
| Refurbishment | Eligible units | $\text{Eligible} \times \text{Refurb}_{\text{per device}}$ |
| Recycling / disposal | Non-resold units | $\text{Recycled} \times \text{Recycling}_{\text{per device}}$ |
| Fixed costs | Program setup / tooling | Flat sum |

$$\text{Total Cost} = \sum(\text{cost components})$$

### 2.2 Revenue & contribution

- **Gross resale revenue:** $\text{Revenue} = \text{Devices}_{\text{resold}} \times \text{Resale Price}_{\text{per device}}$
- **Net program contribution:** $\text{Contribution}_{\text{program}} = \text{Revenue} - \text{Total Cost}$
- **Break-even resale price** — the minimum price per refurbished device needed to cover all costs:

  $$\text{Price}_{\text{break-even}} = \frac{\text{Total Cost}}{\text{Devices}_{\text{resold}}}$$

If contribution is negative, the engine reports the loss as-is — it never clamps to zero.

---

## 3. Stakeholder value split

The program contribution is divided between **ReUse** (the circular operator) and the **Partner** (OEM or retailer) using three contractual levers:

1. **Platform fee** — fee per collected device paid by the Partner to ReUse.
2. **Revenue share %** — share of gross resale revenue remitted to the Partner.
3. **Incentive funding %** — share of consumer trade-in vouchers funded by the Partner (the remainder is funded by ReUse).

The mechanics:

- All operating costs (logistics, processing, refurbishment, recycling, fixed) are borne by ReUse.
- **Partner contribution:**

  $$C_{\text{partner}} = (\text{Revenue} \times \text{Partner Share \%}) - (\text{Collected} \times \text{Platform Fee}) - (\text{Incentives} \times \text{Partner Funding \%})$$

- **ReUse contribution:**

  $$C_{\text{reuse}} = (\text{Revenue} \times (1 - \text{Partner Share \%})) + (\text{Collected} \times \text{Platform Fee}) - (\text{Incentives} \times (1 - \text{Partner Funding \%})) - \text{Operating Costs}$$

By construction, $C_{\text{partner}} + C_{\text{reuse}} \equiv C_{\text{program}}$ — the split always balances.

---

## 4. Environmental impact engine

Environmental claims are computed from **life-cycle displacement**, not assumed 1:1 elimination — and only when sourced data exists.

### Sourced-data requirement

The engine reports **"Insufficient Data"** unless verified inputs are provided for the new-device embodied emissions, substitution rate, and the source and date of those factors. A program without sourced LCA values produces *no* CO₂e figure — the app will not manufacture a green claim.

### Formulation

1. **Displaced new purchases** — refurbishing a device does not always prevent a new purchase; the substitution rate (typically 60–80%) models that elasticity:

   $$\text{Displaced Units} = \text{Devices}_{\text{resold}} \times \frac{\text{Substitution Rate \%}}{100}$$

2. **Gross avoided emissions:**

   $$E_{\text{gross avoided}} = \text{Displaced Units} \times \text{Embodied CO}_2\text{e}_{\text{new device}}$$

3. **Induced process emissions** (refurbishment + logistics):

   $$E_{\text{processing}} = (\text{Devices}_{\text{resold}} \times \text{Refurb CO}_2\text{e}) + (\text{Devices}_{\text{collected}} \times \text{Logistics CO}_2\text{e})$$

4. **Net avoided emissions:**

   $$E_{\text{net avoided}} = E_{\text{gross avoided}} - E_{\text{processing}}$$

---

## 5. Sensitivity & scenarios

- **Sensitivity grid (`runSensitivityAnalysis`)** — varies each key parameter (collection volume, resale price, refurb/processing costs, trade-in voucher) by ±20% independently and ranks variables by their swing in program contribution.
- **Scenario modeling (`compareProgramScenarios`)** — applies coordinated stress tests: *Conservative* (−15% resale price, −10% eligibility, +15% operating costs), *Base*, and *Upside* (+15% resale price, +5% eligibility, −10% operating costs, +20% intake volume).
- **Driver attribution** — ranks which assumptions account for the largest share of the gap between the conservative and upside outcomes, identifying the biggest commercial risk lever.

---

## 6. AI analyst tool suite

The analyst (server route `/api/analyst` with a browser-side rule-based fallback in `src/lib/fallback-agent.ts`) interacts with the engine strictly via structured tool calls:

| Tool | Output |
| :--- | :--- |
| `validateProgramInputs` | Errors, warnings, and missing required inputs |
| `calculateProgramEconomics` | Revenue, cost itemization, contribution, split, break-even price |
| `calculateCircularityMetrics` | Devices collected / reused / recycled, reuse yield, processed weight |
| `calculateEnvironmentalImpact` | Gross & net avoided CO₂e, or an explicit "insufficient data" status |
| `runSensitivityAnalysis` | Ranked single-factor swing table |
| `compareProgramScenarios` | Conservative / base / upside comparison with driver attribution |
| `generatePartnerValueProposition` | Partner-facing text built strictly from calculated outputs |
| `generateDecisionMemo` | Structured decision memo: assumptions, economics, risks, next steps |

What-if overrides can be applied on top of the saved inputs without changing the program.

---

## 7. Storage & offline behavior

- **Storage** — Programs persist in browser `localStorage` via a versioned schema (`src/lib/store.tsx`). No remote database is required; your data stays on the machine you're using.
- **Offline / standalone packaging** — When the AI service is unreachable (including fully offline builds), the client automatically falls back to the local rule-based analyst, which runs the same deterministic tools with no network calls.
- The bundled sample program ("Northwind Mobile") is fictional and illustrative — every number in it is editable.

---

## 8. Testing & verification

Deterministic tests verify that:

1. Missing required inputs halt calculations without crashing or coercing to zero.
2. The ReUse and Partner splits exactly sum to the total program contribution.
3. Environmental impact refuses to output metrics when life-cycle factors lack provenance.
4. The rule-based analyst refuses unsupported claims (e.g., "we saved 500 tonnes of CO₂" with no sourced data).

Run them locally:

```sh
bun test

# or directly with Vitest
bunx vitest run
```
