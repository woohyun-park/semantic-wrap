# @semantic-wrap/en

English | [한국어](./README-ko_kr.md)

`@semantic-wrap/en` provides an experimental English-title phrase model for
`semantic-wrap`.

This package is ESM-only.

## Usage

```ts
import { selectLineBreaks } from "@semantic-wrap/core";
import { enTitleModel } from "@semantic-wrap/en";

const canvasContext = document.createElement("canvas").getContext("2d")!;
canvasContext.font = "700 28px system-ui";

const result = selectLineBreaks({
  text: "Designing products people trust without slowing down delivery",
  model: enTitleModel,
  maxWidth: 420,
  measureText: (text) => canvasContext.measureText(text).width,
});
```

With React, pass `enTitleModel` to `SemanticWrap` or `useSemanticWrap` from
`@semantic-wrap/react`.

> [!WARNING]
> This package is an experimental preset trained on a small dataset. For higher accuracy,
> use a model trained and validated on a large dataset representative of your production
> environment.

The package contains one cumulative model with coarse, medium, and fine levels. See the
[Model Card](./MODEL_CARD.md) for its training scope and known limitations.

## License

Apache-2.0.
