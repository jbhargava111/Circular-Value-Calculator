import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { AppShellPage } from "@/components/AppShellPage";
import { PageHeader } from "@/components/AppShell";
import { runEvaluations, type EvalResult } from "@/lib/eval-cases";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tests")({
  head: () => ({
    meta: [
      { title: "Test panel — ReUse" },
      { name: "description", content: "Live evaluation of the calculation, validation and analyst functions against reliability cases." },
      { property: "og:title", content: "Test panel — ReUse" },
      { property: "og:description", content: "Reliability checks for the ReUse circular value engine." },
    ],
  }),
  component: TestsPage,
});

function TestsPage() {
  const [results, setResults] = useState<EvalResult[]>(() => runEvaluations());
  const [ranAt, setRanAt] = useState(() => new Date().toLocaleTimeString());
  const passed = results.filter((r) => r.pass).length;
  return (
    <AppShellPage>
      <PageHeader title="Test panel" subtitle="Each case runs the real calculation, validation and rule-based analyst functions on fixed inputs."
        actions={<Button onClick={() => { setResults(runEvaluations()); setRanAt(new Date().toLocaleTimeString()); }}>Re-run tests</Button>} />
      <p className="mb-4 text-sm"><b>{passed}/{results.length}</b> passing · last run {ranAt}</p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">#</th><th className="p-3">Case</th><th className="p-3">Expected</th><th className="p-3">Actual</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-3 font-mono">{r.id}</td>
                <td className="p-3"><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.explanation}</div></td>
                <td className="p-3 text-xs">{r.expected}</td>
                <td className="p-3 font-mono text-xs">{r.actual}</td>
                <td className="p-3">{r.pass ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" /> Pass</span> : <span className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" /> Fail</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShellPage>
  );
}
