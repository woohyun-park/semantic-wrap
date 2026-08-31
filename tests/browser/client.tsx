import { createRoot } from "react-dom/client";
import type { LineBreakSelector, PhraseModel } from "../../packages/core/src/index.js";
import { SemanticWrap } from "../../packages/react/src/index.js";

const model: PhraseModel = {
  schemaVersion: 1,
  boundaryMode: "spaces",
  levels: [{ name: "test", model: {}, penalty: 0 }],
  fallbackPenalty: 1,
};

const responsiveSelector: LineBreakSelector = ({ maxWidth }) => ({
  breaks: maxWidth < 260 ? [2] : [],
  applied: maxWidth < 260,
  reason: maxWidth < 260 ? "narrow" : "wide",
});

function App() {
  return (
    <SemanticWrap model={model} selector={responsiveSelector}>
      <h1 id="title" className="title" style={{ width: 200 }}>
        하나 둘 셋
      </h1>
    </SemanticWrap>
  );
}

createRoot(document.querySelector("#root")!).render(<App />);
