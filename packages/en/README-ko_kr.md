# @semantic-wrap/en

[English](./README.md) | 한국어

`@semantic-wrap/en`은 `semantic-wrap`에서 사용할 수 있는 영어 제목용 phrase
model입니다.

이 패키지는 ESM 전용입니다.

## 사용 예시

```ts
import { resolveLineBreaks } from "@semantic-wrap/core";
import { enTitleModel } from "@semantic-wrap/en";

const canvasContext = document.createElement("canvas").getContext("2d")!;
canvasContext.font = "700 28px system-ui";

const result = resolveLineBreaks({
  text: "Designing products people trust without slowing down delivery",
  model: enTitleModel,
  maxWidth: 420,
  measureText: (text) => canvasContext.measureText(text).width,
});
```

React에서는 `@semantic-wrap/react`의 `SemanticWrap` 또는 `useSemanticWrap`에
`enTitleModel`을 전달하세요.

> [!WARNING]
> 이 패키지는 소규모 데이터셋으로 학습한 실험적 프리셋입니다. 정확도를 높이려면
> 실제 사용 환경을 대표하는 대규모 데이터셋으로 학습하고 검증한 모델을 권장합니다.

패키지에는 coarse, medium, fine 단계가 누적된 모델 하나만 포함됩니다. 학습 범위와
알려진 한계는 [Model card](./MODEL_CARD.md)를 참고하세요.

## 라이선스

Apache-2.0.
