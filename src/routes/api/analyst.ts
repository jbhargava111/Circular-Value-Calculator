import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool, isStepCount, type ModelMessage } from "ai";
import { z } from "zod";
import { runTool, TOOL_DESCRIPTIONS, type ToolLogEntry, type ToolName } from "@/lib/agent-tools";
import type { ProgramInputs, ScenarioAdjustments } from "@/lib/calc";

const SYSTEM = `You are the ReUse Circular Value Analyst. ReUse enables device trade-in, refurbishment and resale for OEM and retail partners.
RULES:
- Never compute financial or environmental figures yourself. Always call the provided tools and quote only values they return.
- Never invent market data, emissions factors, partner commitments or ReUse's actual revenue model.
- If calculateEnvironmentalImpact returns "insufficient data", say so plainly and refuse to claim any carbon, water or other environmental savings. Explain which data is missing and how to obtain it (e.g. manufacturer LCA, recognised databases, agreed substitution methodology).
- Distinguish total program value, value captured by ReUse, value captured by the partner, and circularity/environmental outcomes.
- All figures are estimates, not actual results. Say so.
- If inputs are missing, ask targeted follow-up questions.
- Use what-if overrides only when the user asks a hypothetical; state that it is a hypothetical.
- Be concise; use short markdown with headings, bullets and bold only — never tables. Currency is given in the program.`;

const overrideSchema = z.object({
  overrides: z
    .object({
      devicesCollected: z.number().nullable(),
      eligibleRatePct: z.number().nullable(),
      resoldRatePct: z.number().nullable(),
      resalePricePerDevice: z.number().nullable(),
      refurbCostPerDevice: z.number().nullable(),
      tradeInIncentivePerDevice: z.number().nullable(),
    })
    .nullable()
    .describe("Optional what-if overrides of the current program inputs; null to use current inputs."),
});

interface Body {
  messages: { role: "user" | "assistant"; content: string }[];
  inputs: ProgramInputs;
  scenarios: ScenarioAdjustments[];
}

async function handle(request: Request): Promise<Response> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return Response.json({ error: "AI is not configured." }, { status: 503 });
  const body = (await request.json()) as Body;
  const log: ToolLogEntry[] = [];

  const tools = Object.fromEntries(
    (Object.keys(TOOL_DESCRIPTIONS) as ToolName[]).map((name) => [
      name,
      tool({
        description: TOOL_DESCRIPTIONS[name],
        inputSchema: overrideSchema,
        execute: async ({ overrides }) => {
          const output = runTool(name, body.inputs, body.scenarios, overrides);
          log.push({ tool: name, input: { overrides, program: body.inputs.name }, output, at: new Date().toISOString() });
          return output;
        },
      }),
    ]),
  );

  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  try {
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      instructions: `${SYSTEM}\nCurrent program: "${body.inputs.name}" (${body.inputs.partnerType}, ${body.inputs.deviceCategory}, ${body.inputs.currency}).`,
      messages: body.messages.slice(-12) as ModelMessage[],
      tools,
      stopWhen: isStepCount(50),
      abortSignal: request.signal,
      maxRetries: 0,
      providerOptions: {
        openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
      },
    });
    const text = await result.text;
    if (!text.trim()) return Response.json({ error: "The analyst returned no answer.", log }, { status: 502 });
    return Response.json({ reply: text, log, mode: "llm" });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    const status = err.statusCode ?? 500;
    const msg =
      status === 429 ? "Rate limited — please wait a moment and try again."
      : status === 402 ? "AI credits are exhausted for this workspace. Add credits to keep using the AI analyst."
      : err.message ?? "AI request failed.";
    return Response.json({ error: msg, log }, { status });
  }
}

export const Route = createFileRoute("/api/analyst")({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
