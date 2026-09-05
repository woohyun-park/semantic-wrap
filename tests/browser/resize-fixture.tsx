import { useEffect, useState } from "react";
import { SemanticWrap } from "../../packages/react/src/index.js";
import { koTitleModel } from "../../packages/ko/src/index.js";

export function ResizeFixture({ longText }: { longText: string }) {
  const search = new URLSearchParams(location.search);
  const kind = search.get("input") ?? "long";
  const original =
    kind === "short"
      ? "더 나은 제품을 만들기 위해 팀이 버려야 할 습관"
      : kind === "medium"
        ? longText.slice(0, longText.indexOf("디자인과 개발"))
        : kind === "double"
          ? `${longText} ${longText}`
          : kind === "unique"
            ? Array.from(
                { length: 450 },
                (_, i) =>
                  `${i + 1}번째 실험에서는 ${["사용성", "접근성", "가독성", "성능", "정확성"][i % 5]}을 확인합니다.`,
              ).join(" ")
            : longText;
  const [text, setText] = useState(original);
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    let frame = 0;
    const animate = (now: number) => {
      const marker = document.querySelector<HTMLElement>("#resize-heartbeat");
      if (marker) marker.style.transform = `translateX(${((now % 1500) / 1500) * 280}px)`;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <section style={{ fontFamily: "system-ui", padding: 16, color: "#17243a" }}>
      <h1 style={{ margin: "0 0 10px", fontSize: 24 }}>
        {search.get("before") ? "AS-IS · synchronous resize" : "TO-BE · cooperative resize"}
      </h1>
      <div style={{ height: 12, width: 300, background: "#e8edf3", marginBottom: 12 }}>
        <div id="resize-heartbeat" style={{ width: 20, height: 12, background: "#247bc1" }} />
      </div>
      <p id="resize-status" style={{ margin: "8px 0", fontSize: 16 }}>
        Ready · {text.length.toLocaleString()} characters
      </p>
      <input
        aria-label="Width"
        id="resize-slider"
        type="range"
        min="240"
        max="900"
        defaultValue="660"
        onInput={(event) => {
          document.querySelector<HTMLElement>("#resize-container")!.style.width =
            `${event.currentTarget.value}px`;
        }}
        style={{ width: 600 }}
      />
      <button
        id="resize-change-text"
        onClick={() => setText("더 나은 제품을 만들기 위해 팀이 버려야 할 습관")}
      >
        Change text
      </button>
      <button id="resize-toggle" onClick={() => setMounted(!mounted)}>
        Mount/unmount
      </button>
      <div
        id="resize-container"
        style={{ width: 660, border: "2px solid #9bb4cf", padding: 0, marginTop: 12 }}
      >
        {mounted && (
          <SemanticWrap model={koTitleModel}>
            <p
              id="resize-text"
              style={{
                margin: 0,
                font: "600 16px/1.45 system-ui",
                letterSpacing: "-0.035em",
                wordBreak: "keep-all",
              }}
            >
              {text}
            </p>
          </SemanticWrap>
        )}
      </div>
    </section>
  );
}
