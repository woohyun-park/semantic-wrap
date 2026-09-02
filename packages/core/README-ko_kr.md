# @semantic-wrap/core

[English](./README.md) | 한국어

`@semantic-wrap/core`는 모델 예측을 줄바꿈 후보로 통합하고 실제 텍스트 너비에 맞는
layout 후보들을 계산한 뒤, 브라우저의 layout을 포함해 최종 결과를 선택하는
dependency-free engine입니다.

이 패키지는 ESM 전용입니다.

## 사용 예시

```ts
import { selectLineBreaks } from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";

const canvasContext = document.createElement("canvas").getContext("2d")!;
canvasContext.font = "700 28px system-ui";

const result = selectLineBreaks({
  text: "더 나은 사용자 경험을 만드는 방법",
  model: koTitleModel,
  maxWidth: 320,
  measureText: (value) => canvasContext.measureText(value).width,
});

console.log(result.lines);
// ["더 나은 사용자 경험을", "만드는 방법"]
```

브라우저에서 자동 측정하고 `<br>`까지 렌더링하려면 `@semantic-wrap/react`을 함께
사용하세요. 영어와 한국어 프리셋은 `@semantic-wrap/en`과 `@semantic-wrap/ko`에서
제공합니다.

`selectLineBreaks`의 필수 입력은 `text`, `model`, `maxWidth`, `measureText`입니다.
`nativeLayout`, `strategy`, `diagnostics`는 두 번째 options 인자로 전달합니다.

여러 너비를 반복해서 측정할 때는 lazy plan을 만들어 예측과 집계 결과를 재사용할 수
있습니다.

```ts
import { createLineBreakPlan } from "@semantic-wrap/core";

const plan = createLineBreakPlan({ text, model: koTitleModel, strategy });
const predictions = plan.predict();
const candidates = plan.aggregate();
const layouts = plan.calculate({ maxWidth, measureText });
const selection = plan.select({ maxWidth, measureText, nativeLayout });
```

뒤 단계를 바로 호출하면 필요한 앞 단계를 자동 실행합니다. 예측과 집계는 immutable
snapshot으로 캐시하고, 계산과 선택은 measurement마다 다시 실행합니다.

```ts
import {
  consensus,
  createLineBreakStrategy,
  greedy,
} from "@semantic-wrap/core";

const strategy = createLineBreakStrategy({
  aggregate: consensus({ minimumModels: 2 }),
  calculate: greedy(),
});

const result = selectLineBreaks(input, {
  strategy,
  diagnostics: true,
});
```

기본 단계는 `lowestPenalty()`, `optimalLayouts()`, `balance()`입니다. 정상적인 native
layout이 있으면 `balance()`는 줄 수가 같고 모델 비용이 더 낮은 calculated layout만
변경 후보로 허용한 뒤 시각적 균형을 비교합니다. native가 overflow라면 너비 안에
들어오는 calculated layout을 선택할 수 있으며, native가 없으면 calculated 후보들
안에서 선택합니다.

## 공개 API

- `selectLineBreaks`
- `createLineBreakPlan`
- `createLineBreakStrategy`
- `lowestPenalty`, `consensus`
- `optimalLayouts`, `greedy`
- `balance`
- strategy와 phrase model을 구성하는 public types

## 라이선스

Apache-2.0. 수정된 Google BudouX Parser에 관한 고지는 [NOTICE](./NOTICE)를
참고하세요.
