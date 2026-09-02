import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createLineBreakStrategy,
  type LineBreakCalculator,
  type PhraseModel,
} from "../../packages/core/src/index.js";
import { SemanticWrap } from "../../packages/react/src/index.js";
import { useSemanticWrap } from "../../packages/react/src/index.js";
import { createTextMeasurer } from "../../packages/react/src/dom-measure.js";

const model: PhraseModel = {
  boundaryMode: "spaces",
  levels: [{ name: "test", model: {}, penalty: 0 }],
  fallbackPenalty: 1,
};

const responsiveCalculator: LineBreakCalculator = ({ maxWidth }) =>
  [{ breaks: maxWidth < 260 ? [2] : [] }];
const responsiveStrategy = createLineBreakStrategy({
  calculate: responsiveCalculator,
  select: () => ({ selected: "calculated", index: 0, reason: "responsive-test" }),
});

const switchingStrategy = createLineBreakStrategy({
  calculate: ({ maxWidth }) => [{ breaks: maxWidth < 260 ? [2] : [4] }],
  select: () => ({ selected: "calculated", index: 0, reason: "switching-test" }),
});

const alternateProgressiveStrategy = createLineBreakStrategy({
  calculate: () => [{ breaks: [4] }],
  select: () => ({ selected: "calculated", index: 0, reason: "progressive-update-test" }),
});

const whitespaceStrategy = createLineBreakStrategy({
  calculate: () => [{ breaks: [2] }],
  select: () => ({ selected: "calculated", index: 0, reason: "whitespace-test" }),
});

const candidateStrategy = createLineBreakStrategy({
  calculate: () => [{ breaks: [2] }],
  select: () => ({ selected: "calculated", index: 0, reason: "candidate-test" }),
});

function CandidateFixture() {
  const [alternate, setAlternate] = useState(false);
  const candidateModel: PhraseModel = {
    boundaryMode: "spaces",
    levels: [
      {
        name: alternate ? "alternate" : "initial",
        model: { UW3: { 나: 100 } },
        penalty: alternate ? 0.5 : 0,
      },
    ],
    fallbackPenalty: 1,
  };
  const { ref, selection } = useSemanticWrap({
    text: "하나 둘",
    model: candidateModel,
    strategy: candidateStrategy,
  });

  return (
    <section>
      <button id="change-candidate" onClick={() => setAlternate(true)} type="button">
        Change model
      </button>
      <output id="candidate-name">{selection?.selectedCandidates[0]?.name}</output>
      <h2 ref={ref} style={{ width: 200 }}>
        하나 둘
      </h2>
    </section>
  );
}

function ProgressiveFixture() {
  const [alternate, setAlternate] = useState(false);

  return (
    <section>
      <button id="change-progressive-strategy" onClick={() => setAlternate(true)} type="button">
        Change progressive strategy
      </button>
      <SemanticWrap
        mode="progressive"
        model={model}
        strategy={alternate ? alternateProgressiveStrategy : responsiveStrategy}
      >
        <h2 id="progressive-title" className="title" style={{ width: 200 }}>
          하나 둘 셋
        </h2>
      </SemanticWrap>
    </section>
  );
}

function RefFixture() {
  const [visible, setVisible] = useState(true);
  const [cleanupCount, setCleanupCount] = useState(0);
  const [objectAttached, setObjectAttached] = useState(false);
  const objectRef = useRef<HTMLHeadingElement | null>(null);
  const callbackRef = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    return () => setCleanupCount((count) => count + 1);
  }, []);

  useLayoutEffect(() => {
    setObjectAttached(objectRef.current !== null);
  }, [visible]);

  return (
    <section>
      <button id="unmount-ref-title" onClick={() => setVisible(false)} type="button">
        Unmount
      </button>
      <output
        id="ref-status"
        data-callback-cleanups={cleanupCount}
        data-object-attached={String(objectAttached)}
      />
      {visible ? (
        <SemanticWrap model={model} ref={callbackRef}>
          <h2 id="ref-title" ref={objectRef} style={{ width: 320 }}>
            하나 둘
          </h2>
        </SemanticWrap>
      ) : null}
    </section>
  );
}

function FontMeasurementFixture() {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [delta, setDelta] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const measurer = createTextMeasurer(element);
    const range = document.createRange();
    range.selectNodeContents(element);
    setDelta(Math.abs(measurer.measureText(element.textContent ?? "") - range.getBoundingClientRect().width));
    measurer.dispose();
  }, []);

  return (
    <section>
      <span
        ref={textRef}
        style={{
          fontFamily: "system-ui",
          fontSize: 32,
          fontWeight: 720,
          letterSpacing: -1.8,
          whiteSpace: "pre",
        }}
      >
        당연해진 디자인시스템
      </span>
      <output id="font-measurement-delta">{delta}</output>
    </section>
  );
}

function App() {
  return (
    <>
      <SemanticWrap model={model} strategy={responsiveStrategy}>
        <h1 id="title" className="title" style={{ width: 200 }}>
          하나 둘 셋
        </h1>
      </SemanticWrap>

      <ProgressiveFixture />

      <div id="atomic-container" style={{ width: 200 }}>
        <SemanticWrap model={model} strategy={switchingStrategy}>
          <h2 id="atomic-title" className="title" style={{ width: "100%" }}>
            하나 둘 셋
          </h2>
        </SemanticWrap>
      </div>

      <SemanticWrap model={model} strategy={whitespaceStrategy}>
        <h2 id="whitespace-title" style={{ whiteSpace: "pre", width: 200 }}>
          {"하나  둘"}
        </h2>
      </SemanticWrap>

      <RefFixture />
      <CandidateFixture />
      <FontMeasurementFixture />
    </>
  );
}

createRoot(document.querySelector("#root")!).render(<App />);
