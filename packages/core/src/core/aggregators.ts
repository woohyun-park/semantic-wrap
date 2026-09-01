import type {
  BreakCandidate,
  BreakPrediction,
  CandidateAggregationContext,
  CandidateAggregator,
  ConsensusOptions,
} from "./types.js";

function bestPrediction(predictions: readonly BreakPrediction[]): BreakPrediction | undefined {
  return predictions.reduce<BreakPrediction | undefined>(
    (best, prediction) =>
      best === undefined || prediction.penalty < best.penalty ? prediction : best,
    undefined,
  );
}

function candidateFromPrediction(prediction: BreakPrediction): BreakCandidate {
  return {
    offset: prediction.offset,
    level: prediction.level,
    name: prediction.name,
    penalty: prediction.penalty,
  };
}

function fallbackCandidate(offset: number, penalty: number): BreakCandidate {
  return { offset, level: null, penalty };
}

function predictionsAtOffsets(
  context: CandidateAggregationContext,
): Map<number, BreakPrediction[]> {
  const grouped = new Map<number, BreakPrediction[]>();
  for (const prediction of context.predictions) {
    const group = grouped.get(prediction.offset);
    if (group) group.push(prediction);
    else grouped.set(prediction.offset, [prediction]);
  }
  return grouped;
}

/** Keeps the lowest-penalty prediction at each allowed boundary. */
export function lowestPenalty(): CandidateAggregator {
  return (context) => {
    const grouped = predictionsAtOffsets(context);
    return context.allowedOffsets.map((offset) => {
      const prediction = bestPrediction(grouped.get(offset) ?? []);
      return prediction
        ? candidateFromPrediction(prediction)
        : fallbackCandidate(offset, context.fallbackPenalty);
    });
  };
}

/** Gives model priority only to boundaries predicted by enough model levels. */
export function consensus(options: ConsensusOptions): CandidateAggregator {
  if (!Number.isInteger(options.minimumModels) || options.minimumModels <= 0) {
    throw new Error("Consensus minimumModels must be a positive integer");
  }
  return (context) => {
    const grouped = predictionsAtOffsets(context);
    return context.allowedOffsets.map((offset) => {
      const predictions = grouped.get(offset) ?? [];
      const prediction =
        predictions.length >= options.minimumModels
          ? bestPrediction(predictions)
          : undefined;
      return prediction
        ? candidateFromPrediction(prediction)
        : fallbackCandidate(offset, context.fallbackPenalty);
    });
  };
}
