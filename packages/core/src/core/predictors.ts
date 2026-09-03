import { BudouxParser } from "./budoux-parser.js";
import type { BoundaryPredictor, BudouxModel } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateBudouxModel(model: unknown): asserts model is BudouxModel {
  if (!isRecord(model)) {
    throw new Error("BudouX weights must be an object");
  }
  for (const [group, values] of Object.entries(model)) {
    if (!isRecord(values)) {
      throw new Error(`BudouX weight group ${group} must be an object`);
    }
    for (const [feature, weight] of Object.entries(values)) {
      if (typeof weight !== "number" || !Number.isFinite(weight)) {
        throw new Error(`BudouX weight ${group}.${feature} must be finite`);
      }
    }
  }
}

/** Adapts BudouX JSON weights to the generic synchronous predictor contract. */
export function createBudouxPredictor(weights: BudouxModel): BoundaryPredictor {
  validateBudouxModel(weights);
  const parser = new BudouxParser(weights);
  return Object.freeze({
    predict: (text: string) => parser.parseBoundaries(text),
  });
}
