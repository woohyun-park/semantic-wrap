import { validatePhraseModel } from "./phrase-model.js";
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

function validatePredictedOffsets(
  text: string,
  value: unknown,
  levelIndex: number,
): readonly number[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (offset, index) =>
        !Number.isInteger(offset) ||
        offset <= 0 ||
        offset >= text.length ||
        (index > 0 && value[index - 1] >= offset),
    )
  ) {
    throw new Error(
      `Phrase model level ${levelIndex} predictor must return ascending UTF-16 source offsets`,
    );
  }
  return value as readonly number[];
}

export interface BreakPredictionResult {
  predictions: BreakPrediction[];
  allowedOffsets: number[];
  fallbackPenalty: number;
}

/** Runs every model level while preserving each level's boundary predictions. */
export function predictBreaks(text: string, phraseModel: PhraseModel): BreakPredictionResult {
  validatePhraseModel(phraseModel);
  const allowedOffsets =
    phraseModel.boundaryMode === "characters" ? characterOffsets(text) : spaceOffsets(text);
  const allowedSet = new Set(allowedOffsets);
  const predictions: BreakPrediction[] = [];

  phraseModel.levels.forEach((level, levelIndex) => {
    const predictedOffsets = validatePredictedOffsets(
      text,
      level.predictor.predict(text),
      levelIndex,
    );
    const levelOffsets = new Set<number>();
    for (const predictedOffset of predictedOffsets) {
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
