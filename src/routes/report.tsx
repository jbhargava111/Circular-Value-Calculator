import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Printer } from "lucide-react";
import { AppShellPage } from "@/components/AppShellPage";
import { PageHeader, Panel } from "@/components/AppShell";
import { Markdown } from "@/components/Markdown";
import { useProgramStore } from "@/lib/store";
import { generateDecisionMemo, generatePartnerValueProposition } from "@/lib/calc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Partner report — ReUse" },
      { name: "description", content: "Partner-facing value proposition and decision memo built from calculated trade-in results." },
      { property: "og:title", content: "Partner report — ReUse" },
      { property: "og:description", content: "Exportable OEM and retail partner report for device trade-in programs." },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { active } = useProgramStore();
  const [tab, setTab] = useState<"proposition" | "memo">("proposition");
  const text = tab === "proposition"
    ? generatePartnerValueProposition(active.inputs) + "\n\n" + generateDecisionMemo(active.inputs, active.scenarios).split("## 6.")[1]?.replace(/^ Recommended next steps/, "## Recommended next steps")
    : generateDecisionMemo(active.inputs, active.scenarios);
  const download = () => {
    const blob = new Blob([text], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${active.inputs.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${tab}.md`;
    a.click();
  };
  return (
    <AppShellPage>
      <PageHeader title="Partner report" subtitle="Generated deterministically from calculated outputs. Download, copy or print to PDF."
        actions={<div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); }}><Copy className="h-4 w-4" /> Copy</Button>
          <Button variant="outline" onClick={download}><Download className="h-4 w-4" /> Download .md</Button>
          <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / PDF</Button>
        </div>} />
      <div className="mb-4 flex gap-1 print:hidden">
        {(["proposition", "memo"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1.5 text-sm", tab === t ? "bg-primary text-primary-foreground" : "bg-muted")}>{t === "proposition" ? "Partner value proposition" : "Decision memo"}</button>)}
      </div>
      <Panel className="mx-auto max-w-3xl p-10">
        <div className="mb-6 flex items-center justify-between border-b pb-4 text-xs uppercase tracking-wider text-muted-foreground"><span>ReUse · Circular value estimate</span><span>{new Date().toISOString().slice(0, 10)}</span></div>
        <Markdown text={text} />
        {active.illustrative && <p className="mt-8 border-t pt-4 text-xs text-muted-foreground">Based on fictional, illustrative sample data.</p>}
      </Panel>
    </AppShellPage>
  );
}
