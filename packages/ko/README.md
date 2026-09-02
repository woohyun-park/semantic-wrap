# @semantic-wrap/ko

English | [한국어](./README-ko_kr.md)

`@semantic-wrap/ko` provides an experimental Korean-title phrase model for
`semantic-wrap`.

This package is ESM-only.

## Usage

```ts
import { selectLineBreaks } from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";

const canvasContext = document.createElement("canvas").getContext("2d")!;
canvasContext.font = "700 28px system-ui";

const result = selectLineBreaks({
  text: "더 나은 사용자 경험을 만드는 방법",
  model: koTitleModel,
  maxWidth: 320,
  measureText: (text) => canvasContext.measureText(text).width,
});
```

With React, pass `koTitleModel` to `SemanticWrap` or `useSemanticWrap` from
`@semantic-wrap/react`.

> [!WARNING]
> This package is an experimental preset trained on a small dataset. For higher accuracy,
> use a model trained and validated on a large dataset representative of your production
> environment.

The package contains one cumulative model with coarse, medium, and fine levels. See the
[Model Card](./MODEL_CARD.md) for its training scope and known limitations.

## License

Apache-2.0.
