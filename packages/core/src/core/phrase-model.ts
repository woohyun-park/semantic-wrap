import type { PhraseModel } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePhraseModel(model: PhraseModel): void {
  if (!isRecord(model)) {
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
    if (!isRecord(level)) {
      throw new Error(`Phrase model level ${levelIndex} must be an object`);
    }
    if (level.name !== undefined && typeof level.name !== "string") {
      throw new Error(`Phrase model level ${levelIndex} name must be a string`);
    }
    if (!isRecord(level.predictor) || typeof level.predictor.predict !== "function") {
      throw new Error(`Phrase model level ${levelIndex} predictor must provide a predict function`);
    }
  }
  const penalties = [...model.levels.map(({ penalty }) => penalty), model.fallbackPenalty];
  if (penalties.some((penalty) => !Number.isFinite(penalty) || penalty < 0)) {
    throw new Error("Phrase model penalties must be non-negative finite numbers");
  }
}

/** Validates and freezes reusable phrase-model configuration. */
export function definePhraseModel<const Model extends PhraseModel>(model: Model): Model {
  validatePhraseModel(model);
  for (const level of model.levels) {
    Object.freeze(level);
  }
  Object.freeze(model.levels);
  Object.freeze(model);
  return model;
}
