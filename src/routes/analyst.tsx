import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bot, Send, Wrench } from "lucide-react";
import { AppShellPage } from "@/components/AppShellPage";
import { PageHeader, Panel } from "@/components/AppShell";
import { Markdown } from "@/components/Markdown";
import { useProgramStore } from "@/lib/store";
import { runFallbackAnalyst } from "@/lib/fallback-agent";
import type { ToolLogEntry } from "@/lib/agent-tools";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analyst")({
  head: () => ({
    meta: [
      { title: "AI Circularity Analyst — ReUse" },
      { name: "description", content: "Ask an AI analyst that calls the real calculation tools to interpret trade-in economics and circularity." },
      { property: "og:title", content: "AI Circularity Analyst — ReUse" },
      { property: "og:description", content: "Transparent, tool-grounded AI analysis of device trade-in programs." },
    ],
  }),
  component: AnalystPage,
});

const SUGGESTED = [
  "What are the main sources of value in this program?",
  "What are the biggest cost drivers and profitability risks?",
  "How could we improve refurbishment yield and resale value?",
  "Compare the scenarios — what matters most?",
  "How much CO2 does this program save?",
  "What if the resale price dropped to 150?",
  "Write a partner value proposition",
  "Generate a decision memo",
];

interface Msg { role: "user" | "assistant"; content: string; mode?: "llm" | "rule-based"; log?: ToolLogEntry[] | undefined; error?: boolean }

function AnalystPage() {
  const { active } = useProgramStore();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"llm" | "rule-based">("llm");
  const allLogs = msgs.flatMap((m, i) => (m.log ?? []).map((l) => ({ ...l, turn: i, conclusion: m.content.split("\n").find((x) => x.trim()) ?? "", mode: m.mode })));

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    const history = [...msgs, { role: "user" as const, content: q }];
    setMsgs(history);
    setInput("");
    if (mode === "rule-based") {
      const r = runFallbackAnalyst(q, active.inputs, active.scenarios);
      setMsgs([...history, { role: "assistant", content: r.reply, log: r.log, mode: "rule-based" }]);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/analyst", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), inputs: active.inputs, scenarios: active.scenarios }) });
      const data = (await res.json()) as { reply?: string; log?: ToolLogEntry[]; error?: string };
      if (!res.ok || !data.reply) setMsgs([...history, { role: "assistant", content: `${data.error ?? "AI analyst unavailable."} You can switch to the rule-based fallback above.`, log: data.log, error: true, mode: "llm" }]);
      else setMsgs([...history, { role: "assistant", content: data.reply, log: data.log, mode: "llm" }]);
    } catch {
      setMsgs([...history, { role: "assistant", content: "Network error reaching the AI analyst. Switch to the rule-based fallback to continue.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShellPage>
      <PageHeader title="AI Circularity Analyst" subtitle={`Analysing “${active.inputs.name}”. The analyst calls the deterministic calculation tools; it never computes figures itself.`}
        actions={<div className="flex rounded-md border bg-card p-1 text-sm">
          {(["llm", "rule-based"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={cn("rounded px-3 py-1.5", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{m === "llm" ? "AI model (live)" : "Rule-based fallback"}</button>)}
        </div>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Panel className="flex min-h-[560px] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto">
            {msgs.length === 0 && (
              <div className="py-6">
                <div className="mb-4 flex items-center gap-2 text-muted-foreground"><Bot className="h-5 w-5" /> Suggested questions</div>
                <div className="flex flex-wrap gap-2">{SUGGESTED.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border bg-background px-3 py-1.5 text-left text-sm hover:bg-muted">{s}</button>)}</div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={cn("max-w-[90%] rounded-lg px-4 py-3", m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : m.error ? "border border-destructive/40 bg-destructive/5" : "bg-muted")}>
                {m.role === "assistant" && <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{m.mode === "rule-based" ? "Rule-based fallback (templated, real tool calls)" : "AI model (live tool calls)"} · {m.log?.length ?? 0} tool calls</div>}
                {m.role === "user" ? <p className="text-sm">{m.content}</p> : <Markdown text={m.content} />}
              </div>
            ))}
            {busy && <div className="text-sm text-muted-foreground">Analyst is calling tools…</div>}
          </div>
          {msgs.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{SUGGESTED.slice(0, 4).map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted">{s}</button>)}</div>}
          <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="mt-3 flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about economics, risks, scenarios, environmental impact…" className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" />
            <Button type="submit" disabled={busy}><Send className="h-4 w-4" /></Button>
          </form>
        </Panel>
        <Panel title="Tool activity log" right={<span className="text-xs text-muted-foreground">{allLogs.length} calls</span>} className="max-h-[720px] overflow-y-auto">
          {allLogs.length === 0 && <p className="text-sm text-muted-foreground">Every tool the analyst invokes appears here with its inputs, returned results and the conclusion drawn.</p>}
          <ol className="space-y-3">
            {allLogs.map((l, i) => (
              <li key={i} className="rounded-md border bg-background p-3 text-xs">
                <div className="flex items-center gap-2 font-medium"><Wrench className="h-3.5 w-3.5" /> {l.tool}<span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px]">{l.mode === "rule-based" ? "executed · fallback" : "executed · AI"}</span></div>
                <details className="mt-2"><summary className="cursor-pointer text-muted-foreground">Input</summary><pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[10px]">{JSON.stringify(l.input, null, 1)}</pre></details>
                <details className="mt-1"><summary className="cursor-pointer text-muted-foreground">Result</summary><pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap font-mono text-[10px]">{JSON.stringify(l.output, null, 1)}</pre></details>
                <div className="mt-2 text-muted-foreground"><span className="font-medium text-foreground">Conclusion:</span> {l.conclusion.replace(/[*#_]/g, "").slice(0, 160)}</div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </AppShellPage>
  );
}
