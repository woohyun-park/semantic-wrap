import { describe, expect, test } from "bun:test";
import { getBreakCandidates, type PhraseModel } from "../src/index.js";

describe("getBreakCandidates", () => {
  test("supports one or more model levels and keeps the lowest penalty", () => {
    const model: PhraseModel = {
      schemaVersion: 1,
      boundaryMode: "spaces",
      levels: [
        { name: "coarse", model: { UW3: { 나: 100 } }, penalty: 0 },
        { name: "fine", model: { UW3: { 둘: 100 } }, penalty: 0.4 },
      ],
      fallbackPenalty: 1,
    };

    expect(getBreakCandidates("하나 둘 셋 넷", model)).toEqual([
      { offset: 2, level: 0, name: "coarse", penalty: 0 },
      { offset: 4, level: 1, name: "fine", penalty: 0.4 },
      { offset: 6, level: null, penalty: 1 },
    ]);
  });

  test("can use UTF-16-safe character boundaries for future presets", () => {
    const model: PhraseModel = {
      schemaVersion: 1,
      boundaryMode: "characters",
      levels: [{ model: { UW3: { "😀": 100 } }, penalty: 0 }],
      fallbackPenalty: 1,
    };

    expect(getBreakCandidates("😀日本", model).map(({ offset }) => offset)).toEqual([2, 3]);
  });
});
