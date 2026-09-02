import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { selectLineBreaks } from "@semantic-wrap/core";
import { enTitleModel } from "../src/index.js";

describe("English title model", () => {
  test("ships only the frozen cumulative coarse, medium, and fine weights", () => {
    expect(enTitleModel.levels.map(({ name, penalty }) => ({ name, penalty }))).toEqual([
      { name: "coarse", penalty: 0 },
      { name: "medium", penalty: 0.35 },
      { name: "fine", penalty: 0.7 },
    ]);
    expect(
      enTitleModel.levels.map(({ model }) =>
        createHash("sha256").update(JSON.stringify(model)).digest("hex"),
      ),
    ).toEqual([
      "e57521ae39f0a7216137963062fd6d0ca90f7d2af243e4c946ca3056675ea4e9",
      "3661905c25d998b26ca6fcd60ffaa88e90a813dcd1fe84234fae5fabb3799027",
      "a8bf497a49a6f1452d49c07ce54fd08387fea3a709363b0851255a9836ab61f2",
    ]);
  });

  test("returns every source-space fallback without inventing word-internal boundaries", () => {
    const text = "Write headlines for readers not for internal approval";
    const result = selectLineBreaks(
      { text, model: enTitleModel, maxWidth: 30, measureText: (value) => value.length },
      { diagnostics: true },
    );
    const { candidates } = result.diagnostics;

    expect(candidates.length).toBe(text.split(" ").length - 1);
    expect(candidates.every(({ offset }) => text[offset] === " ")).toBe(true);
    expect(candidates.some(({ level }) => level !== null)).toBe(true);
  });

  test("keeps the frozen phrase-boundary predictions for a representative title", () => {
    const text = "Write headlines for readers not for internal approval";
    const result = selectLineBreaks(
      { text, model: enTitleModel, maxWidth: 30, measureText: (value) => value.length },
      { diagnostics: true },
    );

    expect(result.diagnostics.predictions).toEqual([
      { offset: 5, level: 1, name: "medium", penalty: 0.35 },
      { offset: 15, level: 2, name: "fine", penalty: 0.7 },
      { offset: 27, level: 0, name: "coarse", penalty: 0 },
      { offset: 27, level: 1, name: "medium", penalty: 0.35 },
      { offset: 27, level: 2, name: "fine", penalty: 0.7 },
    ]);
    expect(result.breaks).toEqual([27]);
    expect(result.lines).toEqual([
      "Write headlines for readers",
      "not for internal approval",
    ]);
  });
});
