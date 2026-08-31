import { describe, expect, test } from "bun:test";
import {
  balanceSelector,
  greedySelector,
  selectLineBreaks,
  type BreakCandidate,
} from "../src/index.js";

const measureText = (text: string) => text.length;
const candidates: BreakCandidate[] = [
  { offset: 2, level: 0, name: "coarse", penalty: 0 },
  { offset: 4, level: 1, name: "fine", penalty: 0.35 },
];

describe("selectLineBreaks", () => {
  test("selects a semantic layout inside the balance tolerance", () => {
    const result = selectLineBreaks({
      text: "하나 둘 셋",
      candidates,
      maxWidth: 5,
      measureText,
      nativeLayout: { breaks: [4] },
      selector: balanceSelector(),
    });

    expect(result).toMatchObject({
      applied: true,
      reason: "semantic-selected",
      lines: ["하나", "둘 셋"],
      breaks: [2],
      overflow: false,
    });
  });

  test("supports a phrase-first greedy selector", () => {
    const result = selectLineBreaks({
      text: "하나 둘 셋 넷",
      candidates: [
        { offset: 2, level: null, penalty: 1 },
        { offset: 4, level: 0, penalty: 0 },
        { offset: 6, level: null, penalty: 1 },
      ],
      maxWidth: 5,
      measureText,
      selector: greedySelector(),
    });

    expect(result.breaks).toEqual([4]);
    expect(result.lines).toEqual(["하나 둘", "셋 넷"]);
  });

  test("accepts a completely custom selector", () => {
    const result = selectLineBreaks({
      text: "하나 둘 셋",
      candidates,
      maxWidth: 5,
      measureText,
      selector: () => ({ breaks: [4], reason: "product-rule" }),
    });

    expect(result.lines).toEqual(["하나 둘", "셋"]);
    expect(result.reason).toBe("product-rule");
  });

  test("reports an overlong token without inventing character boundaries", () => {
    const result = selectLineBreaks({
      text: "supercalifragilistic",
      candidates: [],
      maxWidth: 8,
      measureText,
      selector: greedySelector(),
    });

    expect(result.breaks).toEqual([]);
    expect(result.overflow).toBe(true);
  });
});
