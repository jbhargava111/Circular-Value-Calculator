import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_SCENARIOS, type ProgramInputs, type ScenarioAdjustments } from "./calc";
import { blankInputs, sampleProgram, type SavedProgram } from "./sample";

const KEY = "reuse-cvc-programs-v1";
const ACTIVE = "reuse-cvc-active-v1";

interface Store {
  ready: boolean;
  programs: SavedProgram[];
  active: SavedProgram;
  setActiveId: (id: string) => void;
  updateInputs: (fn: (p: ProgramInputs) => ProgramInputs) => void;
  updateScenarios: (s: ScenarioAdjustments[]) => void;
  createProgram: () => void;
  duplicateProgram: (id: string) => void;
  deleteProgram: (id: string) => void;
  resetSample: () => void;
}

const Ctx = createContext<Store | null>(null);
const uid = () => Math.random().toString(36).slice(2, 10);

export function ProgramStoreProvider({ children }: { children: ReactNode }) {
  const [programs, setPrograms] = useState<SavedProgram[]>([sampleProgram()]);
  const [activeId, setActiveId] = useState("sample-northwind");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedProgram[];
        if (parsed.length) setPrograms(parsed);
        const a = localStorage.getItem(ACTIVE);
        if (a && parsed.some((p) => p.id === a)) setActiveId(a);
        else if (parsed[0]) setActiveId(parsed[0].id);
      }
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify(programs));
    localStorage.setItem(ACTIVE, activeId);
  }, [programs, activeId, ready]);

  const active = programs.find((p) => p.id === activeId) ?? programs[0]!;

  const store = useMemo<Store>(() => {
    const patch = (id: string, fn: (p: SavedProgram) => SavedProgram) =>
      setPrograms((ps) => ps.map((p) => (p.id === id ? { ...fn(p), updatedAt: new Date().toISOString() } : p)));
    return {
      ready,
      programs,
      active,
      setActiveId,
      updateInputs: (fn) => patch(active.id, (p) => ({ ...p, inputs: fn(p.inputs) })),
      updateScenarios: (s) => patch(active.id, (p) => ({ ...p, scenarios: s })),
      createProgram: () => {
        const n: SavedProgram = { id: uid(), inputs: blankInputs(), scenarios: structuredClone(DEFAULT_SCENARIOS), updatedAt: new Date().toISOString() };
        setPrograms((ps) => [...ps, n]);
        setActiveId(n.id);
      },
      duplicateProgram: (id) => {
        const src = programs.find((p) => p.id === id);
        if (!src) return;
        const n: SavedProgram = { ...structuredClone(src), id: uid(), illustrative: src.illustrative, updatedAt: new Date().toISOString() };
        n.inputs.name = `${src.inputs.name} (copy)`;
        setPrograms((ps) => [...ps, n]);
        setActiveId(n.id);
      },
      deleteProgram: (id) => {
        setPrograms((ps) => {
          const rest = ps.filter((p) => p.id !== id);
          const next = rest.length ? rest : [sampleProgram()];
          if (id === activeId) setActiveId(next[0]!.id);
          return next;
        });
      },
      resetSample: () => {
        setPrograms((ps) => [sampleProgram(), ...ps.filter((p) => p.id !== "sample-northwind")]);
        setActiveId("sample-northwind");
      },
    };
  }, [programs, active, activeId, ready]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useProgramStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useProgramStore outside provider");
  return s;
}
