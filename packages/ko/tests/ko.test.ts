import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { selectLineBreaks } from "@semantic-wrap/core";
import { koTitleModel } from "../src/index.js";

describe("Korean title model", () => {
  test("ships only the frozen cumulative coarse, medium, and fine weights", () => {
    expect(koTitleModel.levels.map(({ name, penalty }) => ({ name, penalty }))).toEqual([
      { name: "coarse", penalty: 0 },
      { name: "medium", penalty: 0.35 },
      { name: "fine", penalty: 0.7 },
    ]);
    expect(
      koTitleModel.levels.map(({ model }) =>
        createHash("sha256").update(JSON.stringify(model)).digest("hex"),
      ),
    ).toEqual([
      "7c8e0102945002aa4cea946d8afb71295d10810315cc61ea63679ac224fc93a2",
      "5aca4c2cb38b5659af68080c98f5e88771e2371cf5bdd1a91dd07ea0ccfe4edd",
      "170bc8868c263f90b87bf8cc780cc23803eaf3f5368071918a19bee2aac1bb54",
    ]);
  });

  test("returns every source-space fallback without inventing word-internal boundaries", () => {
    const text = "더 나은 사용자 경험을 만드는 방법";
    const result = selectLineBreaks(
      { text, model: koTitleModel, maxWidth: 100, measureText: (value) => value.length },
      { diagnostics: true },
    );
    const { candidates } = result.diagnostics;

    expect(candidates.length).toBe(text.split(" ").length - 1);
    expect(candidates.every(({ offset }) => text[offset] === " ")).toBe(true);
    expect(candidates.some(({ level }) => level !== null)).toBe(true);
  });

  test("keeps the frozen phrase-boundary predictions for a representative title", () => {
    const text = "사용자를 이해하고, 더 나은 해결책을 만드는 방법";
    const measureText = (value: string) =>
      [...value].reduce((width, character) => width + (character === " " ? 0.5 : 1), 0);
    const result = selectLineBreaks(
      { text, model: koTitleModel, maxWidth: 14, measureText },
      { diagnostics: true },
    );

    expect(result.diagnostics.predictions).toEqual([
      { offset: 4, level: 2, name: "fine", penalty: 0.7 },
      { offset: 10, level: 2, name: "fine", penalty: 0.7 },
      { offset: 20, level: 1, name: "medium", penalty: 0.35 },
      { offset: 20, level: 2, name: "fine", penalty: 0.7 },
    ]);
    expect(result.breaks).toEqual([10]);
    expect(result.lines).toEqual([
      "사용자를 이해하고,",
      "더 나은 해결책을 만드는 방법",
    ]);
  });
});
