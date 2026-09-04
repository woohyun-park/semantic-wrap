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

## Public API

- `selectLineBreaks`
- `createLineBreakPlan`
- `createLineBreakStrategy`
- `definePhraseModel`
- `createBudouxPredictor`
- `lowestPenalty`, `consensus`
- `optimalLayouts`, `greedy`
- `balance`
- `BoundaryPredictor` and public types for strategies, layouts, and phrase models

## License

Apache-2.0. See [NOTICE](./NOTICE) for the modified Google BudouX parser notice.
