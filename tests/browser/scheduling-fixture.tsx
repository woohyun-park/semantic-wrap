import { Fragment, useLayoutEffect, useMemo, useState } from "react";
import { createBudouxPredictor, createLineBreakStrategy, type LineBreakCalculator, type PhraseModel } from "../../packages/core/src/index.js";
import { SemanticWrap, useSemanticWrap, type SemanticWrapInitial, type SemanticWrapResize } from "../../packages/react/src/index.js";

export interface SchedulingConfig {
  initial: SemanticWrapInitial;
  resize: SemanticWrapResize;
  legacy?: "precise" | "progressive";
  hook: boolean;
  slow: boolean;
  fresh?: string;
}

export function schedulingConfig(search: URLSearchParams): SchedulingConfig {
  return {
    initial: (search.get("initial") ?? "resolved") as SemanticWrapInitial,
    resize: (search.get("resize") ?? "immediate") as SemanticWrapResize,
    legacy: search.get("legacy") as SchedulingConfig["legacy"] ?? undefined,
    hook: search.has("hook"), slow: search.has("slow"),
    fresh: search.get("fresh") ?? undefined,
  };
}

const model: PhraseModel = {
  boundaryMode: "spaces",
  levels: [{ name: "test", predictor: createBudouxPredictor({}), penalty: 0 }],
  fallbackPenalty: 1,
};

function event(kind: string, detail: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const events = Reflect.get(window, "__schedulingEvents") ?? [];
  events.push({ kind, at: performance.now(), ...detail });
  Reflect.set(window, "__schedulingEvents", events);
}

function makeStrategy(slow: boolean, alternate: boolean, fromModel = false, revision = 0) {
  const calculate: LineBreakCalculator = ({ text, maxWidth, candidates }) => {
    event("calculate", { text, width: maxWidth });
    return [{ breaks: [fromModel ? candidates.find((candidate) => candidate.level !== null)!.offset
      : alternate || maxWidth >= 260 ? text.lastIndexOf(" ") : text.indexOf(" ")] }];
  };
  calculate.steps = function* (context) {
    event("start", { text: context.text, width: context.maxWidth });
    let done = false;
    try {
      while (typeof window !== "undefined" && Reflect.get(window, "__holdScheduling")) yield;
      for (let i = 0; i < (slow ? 24 : 1); i++) {
        if (slow) {
          const until = performance.now() + 2;
          while (performance.now() < until) { /* deterministic cancellable test work */ }
        }
        yield;
      }
      const result = calculate(context);
      done = true;
      return result;
    } finally { event(done ? "finish" : "cancel", { text: context.text }); }
  };
  return createLineBreakStrategy({ calculate,
    select: () => ({ selected: "calculated", index: 0, reason: `scheduling-test-${revision}` }) });
}

function HookText({ text, strategy, initial, resize, fresh, alternate, slow, revision, diagnostics }: {
  text: string; strategy: ReturnType<typeof makeStrategy>;
  initial: SemanticWrapInitial; resize: SemanticWrapResize;
  fresh?: string; alternate: boolean; slow: boolean;
  revision: number; diagnostics: boolean;
}) {
  event("render");
  // Also exercise structurally equivalent inline model containers on every hook render.
  const { ref, selection, diagnostics: details } = useSemanticWrap({ text,
    model: { ...model, levels: model.levels.map((level) => ({ ...level,
      name: `test-${revision}`, penalty: revision,
      predictor: fresh === "model" ? { predict: (source: string) => [alternate ? source.lastIndexOf(" ") : source.indexOf(" ")] }
        : fresh === "predictor" || fresh === "both" ? createBudouxPredictor({}) : level.predictor,
    })) },
    strategy: fresh === "strategy" || fresh === "both" ? makeStrategy(slow, alternate, false, revision) : strategy,
    initial, resize, diagnostics });
  useLayoutEffect(() => { event("hook", { selected: selection !== null }); }, [selection]);
  return <><p id="scheduling-text" ref={ref} style={{ margin: 0 }}>
    {selection?.applied ? selection.lines.map((line, i) =>
      <Fragment key={i}>{i > 0 && <br />}{line.trim()}</Fragment>) : text}
  </p><output id="scheduling-result" hidden>{JSON.stringify({ selection, diagnostics: details })}</output></>;
}

export function SchedulingFixture({ config }: { config: SchedulingConfig }) {
  const [text, setText] = useState("하나 둘 셋");
  const [mounted, setMounted] = useState(true);
  const [alternate, setAlternate] = useState(false);
  const [resize, setResize] = useState(config.resize);
  const [revision, setRevision] = useState(0);
  const [diagnostics, setDiagnostics] = useState(false);
  const strategy = useMemo(() => makeStrategy(config.slow, alternate, config.fresh === "model", revision),
    [config.slow, config.fresh, alternate, revision]);
  return <>
    <button id="scheduling-geometry" onClick={() => {
      document.querySelector<HTMLElement>("#scheduling-container")!.style.width = "320px";
      setRevision(revision + 1);
    }}>Geometry and input</button>
    <button id="scheduling-metadata" onClick={() => setRevision(revision + 1)}>Metadata</button>
    <button id="scheduling-diagnostics" onClick={() => setDiagnostics(!diagnostics)}>Diagnostics</button>
    <button id="scheduling-text-change" onClick={() => setText("새로 바꾼 글")}>Text</button>
    <button id="scheduling-strategy" onClick={() => setAlternate(!alternate)}>Strategy</button>
    <button id="scheduling-toggle" onClick={() => setMounted(!mounted)}>Mount</button>
    <button id="scheduling-policy" onClick={() => setResize(resize === "settled" ? "immediate" : "settled")}>Policy</button>
    <div id="scheduling-container" style={{ width: 200, font: "28px/1.25 system-ui", wordBreak: "keep-all" }}>
      {mounted && (config.hook
        ? <HookText text={text} strategy={strategy} initial={config.initial} resize={resize}
            fresh={config.fresh} alternate={alternate} slow={config.slow} revision={revision} diagnostics={diagnostics} />
        : <SemanticWrap model={model} strategy={strategy} {...(config.legacy
            ? { mode: config.legacy } : { initial: config.initial, resize })}>
            <p id="scheduling-text" style={{ margin: 0 }}>{text}</p>
          </SemanticWrap>)}
    </div>
  </>;
}
