import { BudouxParser } from "./budoux-parser.js";
import type { BreakCandidate, PhraseModel } from "./types.js";

function spaceOffsets(text: string): number[] {
  const result: number[] = [];
  for (let offset = 0; offset < text.length; offset += 1) {
    if (/\s/u.test(text[offset]!)) result.push(offset);
  }
  return result;
}

function characterOffsets(text: string): number[] {
  const result: number[] = [];
  let offset = 0;
  for (const character of text) {
    offset += character.length;
    if (offset < text.length) result.push(offset);
  }
  return result;
}

function validateModel(model: PhraseModel): void {
  if (model.schemaVersion !== 1) throw new Error("Unsupported phrase model schema");
  if (model.levels.length === 0) throw new Error("Phrase model must contain at least one level");
  const penalties = [...model.levels.map(({ penalty }) => penalty), model.fallbackPenalty];
  if (penalties.some((penalty) => !Number.isFinite(penalty) || penalty < 0)) {
    throw new Error("Phrase model penalties must be non-negative finite numbers");
  }
}

/** Predicts semantic break boundaries and adds the configured fallback opportunities. */
export function getBreakCandidates(text: string, phraseModel: PhraseModel): BreakCandidate[] {
  validateModel(phraseModel);
  const allowed =
    phraseModel.boundaryMode === "characters" ? characterOffsets(text) : spaceOffsets(text);
  const allowedSet = new Set(allowed);
  const predicted = new Map<number, BreakCandidate>();

  phraseModel.levels.forEach((level, levelIndex) => {
    const parser = new BudouxParser(level.model);
    for (const offset of parser.parseBoundaries(text)) {
      if (!allowedSet.has(offset)) continue;
      const current = predicted.get(offset);
      if (current && current.penalty <= level.penalty) continue;
      predicted.set(offset, {
        offset,
        level: levelIndex,
        name: level.name,
        penalty: level.penalty,
      });
    }
  });

  return allowed.map(
    (offset): BreakCandidate =>
      predicted.get(offset) ?? {
        offset,
        level: null,
        penalty: phraseModel.fallbackPenalty,
      },
  );
}
