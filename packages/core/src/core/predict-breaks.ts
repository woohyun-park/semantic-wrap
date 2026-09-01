import { BudouxParser } from "./budoux-parser.js";
import type { BreakPrediction, PhraseModel } from "./types.js";

function spaceOffsets(text: string): number[] {
  const result: number[] = [];
  let offset = 0;
  while (offset < text.length) {
    if (!/\s/u.test(text[offset]!)) {
      offset += 1;
      continue;
    }
    const runStart = offset;
    while (offset < text.length && /\s/u.test(text[offset]!)) offset += 1;
    if (runStart > 0 && offset < text.length) result.push(runStart);
  }
  return result;
}

function whitespaceRunStart(text: string, offset: number): number {
  let start = offset;
  if (!/\s/u.test(text[start] ?? "")) start -= 1;
  while (start > 0 && /\s/u.test(text[start - 1] ?? "")) start -= 1;
  return start;
}

function normalizeCharacterOffset(text: string, offset: number): number {
  const touchesWhitespace =
    /\s/u.test(text[offset] ?? "") || /\s/u.test(text[offset - 1] ?? "");
  return touchesWhitespace ? whitespaceRunStart(text, offset) : offset;
}

function characterOffsets(text: string): number[] {
  const offsets = new Set<number>();
  const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text);
  for (const { index } of segments) {
    if (index === 0) continue;
    const offset = normalizeCharacterOffset(text, index);
    if (offset <= 0) continue;
    let next = offset;
    while (next < text.length && /\s/u.test(text[next]!)) next += 1;
    if (next < text.length) offsets.add(offset);
  }
  return [...offsets].sort((left, right) => left - right);
}

function validateBudouxModel(model: unknown, levelIndex: number): void {
  if (typeof model !== "object" || model === null || Array.isArray(model)) {
    throw new Error(`Phrase model level ${levelIndex} weights must be an object`);
  }
  for (const [group, values] of Object.entries(model)) {
    if (typeof values !== "object" || values === null || Array.isArray(values)) {
      throw new Error(`Phrase model weight group ${group} must be an object`);
    }
    for (const [feature, weight] of Object.entries(values)) {
      if (typeof weight !== "number" || !Number.isFinite(weight)) {
        throw new Error(
          `Phrase model weight ${group}.${feature} in level ${levelIndex} must be finite`,
        );
      }
    }
  }
}

function validateModel(model: PhraseModel): void {
  if (typeof model !== "object" || model === null || Array.isArray(model)) {
    throw new Error("Phrase model must be an object");
  }
  if (!Array.isArray(model.levels) || model.levels.length === 0) {
    throw new Error("Phrase model must contain at least one level");
  }
  if (
    model.boundaryMode !== undefined &&
    !["spaces", "characters"].includes(model.boundaryMode)
  ) {
    throw new Error('Phrase model boundaryMode must be "spaces" or "characters"');
  }
  for (const [levelIndex, level] of model.levels.entries()) {
    if (typeof level !== "object" || level === null || Array.isArray(level)) {
      throw new Error(`Phrase model level ${levelIndex} must be an object`);
    }
    if (level.name !== undefined && typeof level.name !== "string") {
      throw new Error(`Phrase model level ${levelIndex} name must be a string`);
    }
  }
  const penalties = [...model.levels.map(({ penalty }) => penalty), model.fallbackPenalty];
  if (penalties.some((penalty) => !Number.isFinite(penalty) || penalty < 0)) {
    throw new Error("Phrase model penalties must be non-negative finite numbers");
  }
  model.levels.forEach(({ model: weights }, levelIndex) =>
    validateBudouxModel(weights, levelIndex),
  );
}

export interface BreakPredictionResult {
  predictions: BreakPrediction[];
  allowedOffsets: number[];
  fallbackPenalty: number;
}

/** Runs every model level while preserving each level's boundary predictions. */
export function predictBreaks(text: string, phraseModel: PhraseModel): BreakPredictionResult {
  validateModel(phraseModel);
  const allowedOffsets =
    phraseModel.boundaryMode === "characters" ? characterOffsets(text) : spaceOffsets(text);
  const allowedSet = new Set(allowedOffsets);
  const predictions: BreakPrediction[] = [];

  phraseModel.levels.forEach((level, levelIndex) => {
    const parser = new BudouxParser(level.model);
    const levelOffsets = new Set<number>();
    for (const predictedOffset of parser.parseBoundaries(text)) {
      const offset =
        phraseModel.boundaryMode === "characters"
          ? normalizeCharacterOffset(text, predictedOffset)
          : predictedOffset;
      if (!allowedSet.has(offset)) continue;
      levelOffsets.add(offset);
    }
    for (const offset of levelOffsets) {
      predictions.push({
        offset,
        level: levelIndex,
        name: level.name,
        penalty: level.penalty,
      });
    }
  });

  predictions.sort((left, right) =>
    left.offset === right.offset ? left.penalty - right.penalty : left.offset - right.offset,
  );
  return {
    predictions,
    allowedOffsets,
    fallbackPenalty: phraseModel.fallbackPenalty,
  };
}
