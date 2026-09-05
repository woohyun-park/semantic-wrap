import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "../src/index.js";
import { createLineBreakStrategy, nearbyLayouts } from "@semantic-wrap/core";

describe("SemanticWrap", () => {
  test("keeps SSR source and wrapper semantics with the nearby calculator", () => {
    const strategy = createLineBreakStrategy({ calculate: nearbyLayouts() });
    for (const mode of ["precise", "progressive"] as const) {
      const html = renderToStaticMarkup(
        <SemanticWrap model={koTitleModel} strategy={strategy} mode={mode}>
          <h1>좋은 🙂 경험을 만드는 방법</h1>
        </SemanticWrap>,
      );
      expect(html).toBe(mode === "precise"
        ? '<h1 style="opacity:0">좋은 🙂 경험을 만드는 방법</h1>'
        : '<h1>좋은 🙂 경험을 만드는 방법</h1>');
    }
  });
  test("uses precise mode by default and keeps its SSR text pending without a wrapper", () => {
    const html = renderToStaticMarkup(
      <SemanticWrap model={koTitleModel}>
        <h1 className="title text-3xl">더 나은 사용자 경험을 만드는 방법</h1>
      </SemanticWrap>,
    );

    expect(html).toBe(
      '<h1 class="title text-3xl" style="opacity:0">더 나은 사용자 경험을 만드는 방법</h1>',
    );
  });

  test("renders untouched SSR text in progressive mode", () => {
    const html = renderToStaticMarkup(
      <SemanticWrap mode="progressive" model={koTitleModel}>
        <h1 className="title text-3xl">더 나은 사용자 경험을 만드는 방법</h1>
      </SemanticWrap>,
    );

    expect(html).toBe(
      '<h1 class="title text-3xl">더 나은 사용자 경험을 만드는 방법</h1>',
    );
  });

  test("rejects complex child markup and points consumers to the hook", () => {
    expect(() =>
      renderToStaticMarkup(
        <SemanticWrap model={koTitleModel}>
          <h1>제목 <strong>강조</strong></h1>
        </SemanticWrap>,
      ),
    ).toThrow("useSemanticWrap");
  });
});
