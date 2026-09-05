# @semantic-wrap/core

English | [한국어](./README-ko_kr.md)

`@semantic-wrap/core` is the dependency-free engine behind `semantic-wrap`. It aggregates
model predictions into boundary candidates, calculates layout candidates at the target text
width, and selects a final result together with an optional native layout.

This package is ESM-only.

## Usage

```ts
import { selectLineBreaks } from "@semantic-wrap/core";
import { enTitleModel } from "@semantic-wrap/en";

const canvasContext = document.createElement("canvas").getContext("2d")!;
canvasContext.font = "700 28px system-ui";

const result = selectLineBreaks({
  text: "Write headlines for readers not for internal approval",
  model: enTitleModel,
  maxWidth: 420,
  measureText: (value) => canvasContext.measureText(value).width,
});

console.log(result.lines);
// ["Write headlines for readers", "not for internal approval"]
```

Use `@semantic-wrap/react` to measure a browser element and render the selected result as
`<br>` elements. Experimental English and Korean presets are available from
`@semantic-wrap/en` and `@semantic-wrap/ko`.

`selectLineBreaks` requires `text`, `model`, `maxWidth`, and `measureText`. Pass
`nativeLayout`, `strategy`, and `diagnostics` in its optional second argument.

For repeated measurements, create one lazy plan and reuse its prediction and aggregation:

```ts
import { createLineBreakPlan } from "@semantic-wrap/core";

const plan = createLineBreakPlan({ text, model: enTitleModel, strategy });
const predictions = plan.predict();
const candidates = plan.aggregate();
const layouts = plan.calculate({ maxWidth, measureText });
const selection = plan.select({ maxWidth, measureText, nativeLayout });
```

Calling a later method runs its prerequisites automatically. Prediction and aggregation are
cached as immutable snapshots; calculation and selection run for each measurement.

Measurement inputs also accept an optional synchronous `measureTexts(texts)` function.
It must return an array with one finite, non-negative width per input, in the same order,
equivalent to `texts.map(measureText)`. Core can use it to measure independent segments
together while preserving the global search. `measureText` remains required for scalar
requests and calculators that do not use batching. Measurement functions must return
consistent widths for the same text and style, independent of call order.
React supplies both functions automatically; Core has no DOM dependency.

`plan.selectSteps(input)` exposes the same selection as a synchronous generator. Advancing
it performs bounded units of work; its return value is the completed selection. Callers own
scheduling and can cancel with `return()`. Existing `select` and `calculate` calls consume
the same work synchronously. The default optimal calculator supplies `calculate.steps`;
custom calculators without that optional iterator execute as one indivisible call.

Reusable plans accept an optional `cacheKey` object in measurement inputs. Reuse its identity
only while the exact measured widths remain valid; replace it when fonts or any other text
metrics change. The global calculator retains up to 65,536 offset-keyed segment widths.
Eviction affects speed only. Without `cacheKey`, segment widths are not reused across calls.

## Phrase models and predictors

Each `PhraseModel` level provides one synchronous `predictor`. `definePhraseModel` validates
and freezes reusable configuration, while `createBudouxPredictor` adapts BudouX weights to
the generic predictor contract.

```ts
import {
  createBudouxPredictor,
  definePhraseModel,
} from "@semantic-wrap/core";

const colonModel = definePhraseModel({
  boundaryMode: "spaces",
  levels: [{
    name: "after-colon",
    predictor: createBudouxPredictor({ UW3: { ":": 100 } }),
    penalty: 0,
  }],
  fallbackPenalty: 1,
});
```

A custom `BoundaryPredictor` returns strictly ascending UTF-16 source offsets inside the
text. Core filters them through the model's `boundaryMode` before creating candidates.

## Strategy

The strategy exposes three replaceable stages:

```text
aggregate boundary predictions
  → calculate multiple layout candidates
  → select from the calculated layouts and nativeLayout
```

```ts
import {
  balance,
  consensus,
  createLineBreakStrategy,
  greedy,
} from "@semantic-wrap/core";

const strategy = createLineBreakStrategy({
  aggregate: consensus({ minimumModels: 2 }),
  calculate: greedy(),
  select: balance({ tolerance: 0.12 }),
});

const result = selectLineBreaks(input, {
  strategy,
  diagnostics: true,
});
```

The default stages are `lowestPenalty()`, `optimalLayouts()`, and `balance()`.
When a fitting native layout is present, `balance()` only allows same-line-count calculated
layouts with a lower model cost to replace it. Visual balance is then used as an acceptance
and selection criterion. An overflowing native layout may be replaced by any fitting
calculated layout; without a native layout, Core selects among calculated layouts normally.

## Opt-in native neighborhood search

`nearbyLayouts()` restricts each break to the candidate boundaries around the corresponding
native break. It measures actual substrings and runs DP with Pareto pruning within that
restricted space. The default `radius: 2` considers up to five boundaries per native break;
`radius: 1` and `radius: 4` consider up to three and nine respectively.

```ts
import { createLineBreakStrategy, nearbyLayouts } from "@semantic-wrap/core";

const strategy = createLineBreakStrategy({ calculate: nearbyLayouts({ radius: 2 }) });
const result = selectLineBreaks(input, { strategy, nativeLayout });
```

This is a speed/quality trade-off, not an equivalent replacement for `optimalLayouts()`.
It keeps the supplied native line count and may miss better semantic or balanced layouts
outside the neighborhoods. `balance()` still checks actual overflow and requires model
improvement before replacing a fitting native layout. No fitting local path returns the
unbroken fallback candidate, so the default selector can preserve native wrapping.
Without `nativeLayout`, it falls back to `optimalLayouts()`.

Native breaks are now available as `LayoutCalculationContext.nativeLayout`. Core validates
and freezes that snapshot before invoking the calculator. Both `plan.calculate()` and
`plan.select()` accept native breaks. DOM measurement remains the caller's responsibility;
React supplies it automatically. All APIs remain synchronous, and the default calculator
remains `optimalLayouts()`.

The number of measured transitions is bounded by the neighborhood sizes and line count,
but Pareto frontier size is not capped. There is no fixed runtime guarantee for arbitrary
custom models.

## Public API

- `selectLineBreaks`
- `createLineBreakPlan`
- `createLineBreakStrategy`
- `definePhraseModel`
- `createBudouxPredictor`
- `lowestPenalty`, `consensus`
- `optimalLayouts`, `nearbyLayouts`, `greedy`
- `balance`
- `BoundaryPredictor` and public types for strategies, layouts, and phrase models

## License

Apache-2.0. See [NOTICE](./NOTICE) for the modified Google BudouX parser notice.
