import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap, type SemanticWrapProps } from "../src/index.js";
import { createLineBreakStrategy, nearbyLayouts } from "@semantic-wrap/core";

describe("SemanticWrap", () => {
  test("supports all four SSR combinations without leaking scheduling props to the DOM", () => {
    for (const initial of ["resolved", "native"] as const) {
      for (const resize of ["immediate", "settled"] as const) {
        const html = renderToStaticMarkup(
          <SemanticWrap model={koTitleModel} initial={initial} resize={resize}>
            <p style={{ color: "red", opacity: 0.7 }}>하나 둘 셋</p>
          </SemanticWrap>,
        );
        expect(html).toBe(`<p style="color:red;opacity:${initial === "resolved" ? 0 : 0.7}">하나 둘 셋</p>`);
      }
    }
  });

  test("rejects mixed legacy/new props and invalid policies at runtime", () => {
    for (const props of [
      { mode: "precise", initial: "resolved" },
      { mode: "progressive", resize: "settled" },
      { initial: "wrong" }, { resize: "wrong" }, { mode: "wrong" },
    ]) {
      expect(() => renderToStaticMarkup(<SemanticWrap
        {...({ model: koTitleModel, ...props } as unknown as SemanticWrapProps)}
      ><p>하나 둘 셋</p></SemanticWrap>)).toThrow("SemanticWrap");
    }
  });

  test("rejects mixed legacy/new props at compile time", () => {
    // @ts-expect-error legacy and new scheduling are mutually exclusive
    const invalid: SemanticWrapProps = { model: koTitleModel, mode: "precise", initial: "native", children: <p /> };
    expect(invalid.mode).toBe("precise");
    const legacy = (mode: "precise" | "progressive" | undefined): SemanticWrapProps => ({
      model: koTitleModel, mode, children: <p />,
    });
    expect(legacy(undefined).mode).toBeUndefined();
  });
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
