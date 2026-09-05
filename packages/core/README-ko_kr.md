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

측정 입력에는 선택적으로 동기 함수 `measureTexts(texts)`를 제공할 수 있습니다.
`texts.map(measureText)`와 같은 너비를 입력 순서대로 배열로 반환해야 하며, 각 너비는
0 이상의 유한한 수여야 합니다. Core는 독립적인 구간을 묶어 측정해도 기존 전체 탐색과
선택 결과를 유지합니다. 개별 측정을 위한 `measureText`도 계속 필요합니다. 같은 텍스트와
스타일의 너비는 호출 순서에 관계없이 일정해야 합니다. React는 두 함수를 자동으로 제공합니다.

`plan.selectSteps(input)`은 같은 선택 결과를 만드는 동기 generator입니다. 호출자가 작업을
나누어 진행할 시점과 취소(`return()`)를 결정합니다. 기존 `select`와 `calculate`는 같은
작업을 동기적으로 끝까지 실행합니다. 사용자 calculator는 선택적으로 `steps`를 제공할 수
있으며, 제공하지 않은 동기 콜백은 실행 도중 중단되지 않습니다.

측정 입력의 선택적 `cacheKey` 객체로 구간 너비를 재사용할 수 있습니다. 실제 너비가 유효한
동안에만 같은 객체를 사용하고 글꼴 등 측정 조건이 바뀌면 새 객체를 전달하세요.
최대 65,536개 구간을 시작·끝 offset으로 저장하며, 캐시 제거는 속도에만 영향을 줍니다.

## 기본 줄바꿈 주변만 탐색하기

```ts
import { createLineBreakStrategy, nearbyLayouts } from "@semantic-wrap/core";

const strategy = createLineBreakStrategy({ calculate: nearbyLayouts({ radius: 2 }) });
const result = selectLineBreaks(input, { strategy, nativeLayout });
```

`nearbyLayouts()`는 기본 줄바꿈 주변 후보만 실제 너비로 측정하고 DP와 Pareto pruning을
적용합니다. `radius`는 1·2·4를 지원하며, 각각 경계마다 최대 3·5·9개 후보를 고려합니다.
줄 수는 기본 결과와 같게 유지하지만, 탐색 범위 밖의 더 좋은 조합을 놓칠 수 있습니다.
기존 `balance()`의 overflow 및 의미 개선 검사는 유지합니다. 적합한 경로가 없으면
줄바꿈 없는 후보를 반환해 기본 선택기가 native 결과를 유지할 수 있게 합니다.

`nativeLayout`이 없으면 `optimalLayouts()`를 사용합니다. `plan.calculate()`와
`plan.select()` 모두 native 결과를 받을 수 있고, 계산기에는 검증·동결된
`context.nativeLayout`을 전달합니다. React는 이 값을 자동으로 제공합니다.
동기 API와 기본 계산기 `optimalLayouts()`는 그대로입니다. Pareto 후보 수는 제한하지
않으므로 임의의 모델에 대해 일정한 실행 시간을 보장하지는 않습니다.

## Phrase model과 predictor

각 `PhraseModel` level에는 동기식 `predictor`를 넣습니다. `definePhraseModel`은 재사용할
설정을 검증하고 동결하며, `createBudouxPredictor`는 BudouX 가중치를 공통 predictor
계약으로 변환합니다.

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

Custom `BoundaryPredictor`는 문자열 내부의 UTF-16 source offset을 오름차순으로
반환합니다. Core는 후보를 만들기 전에 `boundaryMode`가 허용하는 위치만 남깁니다.

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
- `definePhraseModel`
- `createBudouxPredictor`
- `lowestPenalty`, `consensus`
- `optimalLayouts`, `greedy`
- `balance`
- `BoundaryPredictor`와 strategy, layout, phrase model을 구성하는 public types

## 라이선스

Apache-2.0. 수정된 Google BudouX Parser에 관한 고지는 [NOTICE](./NOTICE)를
참고하세요.
