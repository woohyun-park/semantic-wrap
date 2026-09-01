import type {
  BalanceOptions,
  LayoutSelectionDecision,
  LineBreakLayout,
  LineBreakSelector,
} from "./types.js";

const EPSILON = 1e-9;

interface SelectableLayout {
  source: "native" | "calculated";
  index?: number;
  layout: LineBreakLayout;
}

function signature(layout: LineBreakLayout): string {
  return layout.breaks.join(",");
}

function decision(
  choice: SelectableLayout,
  nativeReason = "native-selected",
): LayoutSelectionDecision {
  return choice.source === "native"
    ? { selected: "native", reason: nativeReason }
    : {
        selected: "calculated",
        index: choice.index!,
        reason: "calculated-selected",
      };
}

function selectByBalance(
  layouts: SelectableLayout[],
  tolerance: number,
): LayoutSelectionDecision {
  const minimumLineCount = Math.min(...layouts.map(({ layout }) => layout.lineCount));
  let eligible = layouts.filter(({ layout }) => layout.lineCount === minimumLineCount);

  const bestBalance = Math.min(...eligible.map(({ layout }) => layout.balanceScore));
  eligible = eligible.filter(
    ({ layout }) => layout.balanceScore <= bestBalance + tolerance + EPSILON,
  );

  eligible.sort((left, right) => {
    const modelCost = left.layout.modelCost - right.layout.modelCost;
    if (Math.abs(modelCost) > EPSILON) return modelCost;
    const balanceScore = left.layout.balanceScore - right.layout.balanceScore;
    if (Math.abs(balanceScore) > EPSILON) return balanceScore;
    if (left.source !== right.source) return left.source === "native" ? -1 : 1;
    return signature(left.layout).localeCompare(signature(right.layout));
  });

  return decision(eligible[0]!);
}

/** Requires model improvement before replacing a fitting native layout. */
export function balance(options: BalanceOptions = {}): LineBreakSelector {
  const tolerance = options.tolerance ?? 0.12;
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1) {
    throw new Error("Balance tolerance must be between zero and one");
  }

  return ({ calculatedLayouts, nativeLayout }) => {
    const calculated = calculatedLayouts.map(
      (layout, index): SelectableLayout => ({ source: "calculated", index, layout }),
    );
    const native: SelectableLayout | undefined = nativeLayout
      ? { source: "native", layout: nativeLayout }
      : undefined;
    if (!native && calculated.length === 0) {
      throw new Error("A selector requires at least one layout");
    }

    if (!native) {
      const fitting = calculated.filter(({ layout }) => !layout.overflow);
      return selectByBalance(fitting.length > 0 ? fitting : calculated, tolerance);
    }

    const fittingCalculated = calculated.filter(({ layout }) => !layout.overflow);
    if (native.layout.overflow) {
      return fittingCalculated.length > 0
        ? selectByBalance(fittingCalculated, tolerance)
        : decision(native);
    }

    const modelImproved = fittingCalculated.filter(
      ({ layout }) =>
        layout.lineCount === native.layout.lineCount &&
        layout.modelCost < native.layout.modelCost - EPSILON,
    );
    if (modelImproved.length === 0) {
      return decision(native, "native-no-model-improvement");
    }

    return selectByBalance([...modelImproved, native], tolerance);
  };
}
