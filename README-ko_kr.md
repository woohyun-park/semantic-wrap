<div align="center">
  <img src="./assets/semantic-wrap-lockup.webp" alt="semantic-wrap" />
  <br />
  <p>
    <a href="https://www.npmjs.com/package/@semantic-wrap/core"><img src="https://img.shields.io/npm/v/@semantic-wrap/core.svg?style=flat-square&colorA=000&colorB=000" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/@semantic-wrap/core"><img src="https://img.shields.io/npm/dm/@semantic-wrap/core.svg?style=flat-square&colorA=000&colorB=000" alt="npm downloads" /></a>
    <a href="https://github.com/woohyun-park/semantic-wrap"><img src="https://img.shields.io/github/stars/woohyun-park/semantic-wrap?style=flat-square&colorA=000&colorB=000" alt="GitHub stars" /></a>
    <a href="https://github.com/woohyun-park/semantic-wrap/blob/main/LICENSE"><img src="https://img.shields.io/github/license/woohyun-park/semantic-wrap?style=flat-square&colorA=000&colorB=000" alt="Apache-2.0 License" /></a>
  </p>
  <p><a href="./README.md">English</a> | 한국어</p>
</div>

## semantic-wrap이란?

`semantic-wrap`은 학습된 모델과 실제 렌더링 결과를 바탕으로 줄바꿈 위치를 선택하는
JavaScript 라이브러리입니다. 모델이 찾은 경계 후보와 브라우저의 기본 줄바꿈을
비교하고, 더 적합한 결과가 있으면 해당 위치에 `<br>`을 삽입합니다. 사용하는 모델과
선택 방식에 따라 줄바꿈 기준을 바꿀 수 있습니다. 한국어 문장을 읽을 때 자연스럽다고
느끼는 줄바꿈을 브라우저에서도 재현해볼 수 없을까 하는 고민에서 출발했습니다.

Core는 특정 언어에 종속되지 않으며, 현재 영어 제목용 `@semantic-wrap/en`과 한국어
제목용 `@semantic-wrap/ko` 프리셋을 제공합니다.

## 결과 예시

| 브라우저의 기본 줄바꿈 | semantic-wrap |
| --- | --- |
| 디자인 시스템을 도입하기<br>전에 반드시 확인해야 할 기준 | 디자인 시스템을 도입하기 전에<br>반드시 확인해야 할 기준 |
| 모바일 환경에서 읽기<br>좋은 제목을 만드는 방법 | 모바일 환경에서<br>읽기 좋은 제목을 만드는 방법 |
| 효율적인 회의를 만들기<br>위해 버려야 할 습관 | 효율적인 회의를 만들기 위해<br>버려야 할 습관 |
| 사용자를 이해하고, 더<br>나은 해결책을 만드는 방법 | 사용자를 이해하고,<br>더 나은 해결책을 만드는 방법 |

## 빠르게 시작하기

### 설치

React에서 한국어 모델을 사용하려면 다음 패키지를 설치합니다.

```sh
npm install @semantic-wrap/core @semantic-wrap/react @semantic-wrap/ko react react-dom
```

`@semantic-wrap/react`는 React와 React DOM 19 이상을 지원합니다. Core나 모델만
사용하는 환경에는 React가 필요하지 않습니다.

세 패키지는 모두 ESM 전용입니다.

### React에서 사용하기

```tsx
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "@semantic-wrap/react";

export function Title({ children }: { children: string }) {
  return (
    <SemanticWrap model={koTitleModel}>
      <h1 className="title">{children}</h1>
    </SemanticWrap>
  );
}
```

`SemanticWrap`은 별도의 엘리먼트를 추가하지 않습니다. 기본값인 precise 모드는 SSR
원문을 HTML에 유지하되 최초의 정확한 선택이 준비될 때까지 opacity를 0으로 둔 뒤
결과를 표시합니다. progressive 모드는 SSR 원문을 전혀 변경하지 않고 첫 viewport
또는 element resize부터 precise 선택을 시작합니다.

## 동작 방식

1. 모델의 예측을 줄바꿈 경계 후보로 통합합니다.
2. 실제 글꼴과 너비를 기준으로 가능한 layout 후보들을 계산합니다.
3. 정상적인 브라우저 layout을 바꾸려면 모델 비용이 더 낮아야 하며, 그 후보들의
   시각적 균형을 비교해 최종 결과를 선택합니다.
4. 계산된 후보가 선택되면 해당 위치에 `<br>`을 삽입합니다.

엘리먼트의 크기가 달라지거나 웹 폰트 로딩이 끝나면 다시 측정하므로 반응형
레이아웃에서도 사용할 수 있습니다.

| 패키지 | 역할 |
| --- | --- |
| `@semantic-wrap/core` | 줄바꿈 후보를 만들고 그중 하나를 선택합니다. |
| `@semantic-wrap/react` | 화면을 측정하고 선택된 줄바꿈을 React에 적용합니다. |
| `@semantic-wrap/en` | 영어 제목을 위해 학습된 실험적 모델을 제공합니다. |
| `@semantic-wrap/ko` | 한국어 제목을 위해 학습된 모델을 제공합니다. |

## 패키지별 사용법

### `@semantic-wrap/core`

`@semantic-wrap/core`는 모델 예측부터 최종 layout 선택까지 한 번에 실행합니다. DOM이나
React에 의존하지 않으므로 문자열 너비를 측정할 수 있는 환경이라면 어디서든 사용할 수
있습니다.

#### `selectLineBreaks(input, options?)`

`selectLineBreaks`는 모델의 예측을 줄바꿈 후보로 모으고, 가능한 layout 후보들을 계산한
뒤, `nativeLayout`까지 포함해 최종 결과를 선택합니다.

`input`:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `text` | `string` | 줄바꿈을 적용할 원문 |
| `model` | `PhraseModel` | 경계와 우선순위를 예측할 모델 |
| `maxWidth` | `number` | 한 줄에 사용할 수 있는 최대 너비 |
| `measureText` | `(text: string) => number` | 문자열을 실제 글꼴 기준으로 측정해 너비를 반환하는 함수 |

Core는 특정 렌더링 환경에 의존하지 않기 때문에 `measureText`를 직접 받습니다. 브라우저에서는
위 예시처럼 Canvas로 만들 수 있고, React 패키지는 렌더링된 엘리먼트에서 자동으로
만듭니다.

`options`:

| 필드 | 타입 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `nativeLayout` | `BaselineLayout` | 아니요 | 없음 | 비교 대상으로 사용할 기존 줄바꿈. `breaks`에 마지막 줄을 제외한 UTF-16 offset을 오름차순으로 전달합니다. |
| `strategy` | `LineBreakStrategy` | 아니요 | 기본 strategy | 후보 통합, layout 후보 계산, 최종 선택 규칙을 변경합니다. |
| `diagnostics` | `boolean` | 아니요 | `false` | 예측과 각 단계의 중간 결과를 반환값에 포함합니다. |

`nativeLayout`을 전달하면 계산된 layout 후보들과 함께 최종 선택 대상으로 평가합니다.
생략하면 계산된 후보들 안에서 결과를 선택합니다. `SemanticWrap`과 `useSemanticWrap`은
브라우저가 실제로 나눈 줄을 측정해 `nativeLayout`으로 자동 전달합니다. 기본 selector는
native가 overflow일 때 fitting calculated layout을 허용합니다. 그 외에는 줄 수가 같고
`modelCost`가 더 낮은 후보만 native를 대체할 수 있습니다.

#### `createLineBreakPlan(input)`

같은 원문, 모델, strategy를 여러 너비에서 반복 측정한다면 lazy plan을 사용합니다.

```ts
const plan = createLineBreakPlan({ text, model, strategy });

plan.predict();
plan.aggregate();
plan.calculate({ maxWidth, measureText });
plan.select({ maxWidth, measureText, nativeLayout });
```

뒤 단계를 호출하면 필요한 앞 단계를 자동 실행합니다. 예측과 집계는 immutable
snapshot으로 캐시하고 계산과 선택은 measurement마다 실행합니다.

출력: `LineBreakSelection`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `text` | `string` | 입력받은 원문 |
| `lines` | `string[]` | 선택된 위치를 기준으로 나눈 문자열 배열 |
| `breaks` | `number[]` | 마지막 줄을 제외한 각 줄 끝의 UTF-16 offset |
| `widths` | `number[]` | 각 줄을 `measureText`로 측정한 너비 |
| `selectedCandidates` | `BreakCandidate[]` | 선택된 offset에 해당하는 후보와 모델 정보 |
| `applied` | `boolean` | 계산된 줄바꿈을 적용해야 하면 `true` |
| `reason` | `string` | 최종 layout을 선택한 이유 |
| `overflow` | `boolean` | 선택된 줄 중 `maxWidth`를 넘는 줄이 있으면 `true` |
| `diagnostics` | `LineBreakDiagnostics` | `diagnostics: true`일 때만 포함되는 단계별 중간 결과 |

사용 예시:

```ts
import { selectLineBreaks } from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";

const canvas = document.createElement("canvas");
const canvasContext = canvas.getContext("2d")!;
canvasContext.font = "700 28px system-ui";

const result = selectLineBreaks({
  text: "더 나은 사용자 경험을 만드는 방법",
  model: koTitleModel,
  maxWidth: 320,
  measureText: (text) => canvasContext.measureText(text).width,
});

console.log(result.lines);
// ["더 나은 사용자 경험을", "만드는 방법"]
```

#### 커스텀 모델 사용하기

`selectLineBreaks`는 `PhraseModel` 인터페이스를 만족하는 모델이라면 어떤 모델이든
사용할 수 있습니다. `koTitleModel` 대신 별도로 학습한 모델을 전달하거나, 여러 모델을
`levels`로 구성해 각 모델의 예측을 함께 사용할 수도 있습니다.

`PhraseModel`은 다음 필드로 구성됩니다.

| 필드 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `levels` | 예 | - | 모델과 `penalty`를 담은 하나 이상의 단계 |
| `fallbackPenalty` | 예 | - | 어떤 단계도 찾지 않은 일반 경계의 비용 |
| `boundaryMode` | 아니요 | `"spaces"` | `"spaces"`는 공백, `"characters"`는 Unicode grapheme 경계를 사용하며 인접한 공백 묶음은 하나의 경계로 합침 |

각 level의 `penalty`는 해당 모델이 예측한 경계의 비용입니다. 값이 낮을수록 layout을
계산할 때 우선하며, 여러 level이 같은 경계를 예측하면 기본 `aggregate` 단계는 가장
낮은 `penalty`를 사용합니다.

다음 예시는 콜론(`:`) 뒤의 공백을 선호하는 독립적인 모델을 만듭니다. 실제
서비스에서는 충분한 데이터로 학습하고 검증한 모델을 사용하세요.

사용 예시:

```ts
import {
  selectLineBreaks,
  type PhraseModel,
} from "@semantic-wrap/core";

const canvasContext = document.createElement("canvas").getContext("2d")!;
canvasContext.font = "700 28px system-ui";

const colonTitleModel: PhraseModel = {
  boundaryMode: "spaces",
  levels: [
    {
      name: "after-colon",
      model: { UW3: { ":": 100 } },
      penalty: 0,
    },
  ],
  fallbackPenalty: 1,
};

const text = "서비스 업데이트: 새로운 기능을 사용하는 방법";
const input = {
  text,
  maxWidth: 400,
  measureText: (value: string) => canvasContext.measureText(value).width,
};

const customResult = selectLineBreaks({
  ...input,
  model: colonTitleModel,
});

console.log(customResult.lines);
// ["서비스 업데이트:", "새로운 기능을 사용하는 방법"]
```

`UW3`는 줄바꿈 후보 바로 앞의 한 글자를 나타내는 BudouX feature입니다.
`UW3: { ":": 100 }`은 콜론 바로 뒤를 경계로 예측하도록 점수를 부여합니다. `100`은
확률이 아니라 BudouX가 경계를 판정할 때 사용하는 가중치입니다.

#### Strategy

기본 strategy는 다음 세 단계를 순서대로 실행합니다.

| 단계 | 입력 | 기본 규칙 | 개입할 수 있는 부분 |
| --- | --- | --- | --- |
| `aggregate` | 모델별 원본 예측 | 같은 경계에서는 가장 낮은 `penalty`를 사용 | 여러 모델의 합의 조건, 제품별 가중치 |
| `calculate` | 통합된 후보와 렌더링 너비 | 최소 줄 수에서 균형 점수와 모델 비용이 지배되지 않는 layout 후보들을 계산 | 줄 수 제한, 금지 경계, 탐욕적 계산 |
| `select` | 계산된 layout 후보들과 `nativeLayout` | native보다 모델 비용이 낮은 후보만 허용한 뒤 시각적 균형을 비교 | 제품별 점수나 적용 조건 |

`createLineBreakStrategy`에 바꾸고 싶은 단계만 전달하면 나머지는 기본 규칙을 사용합니다.

`calculate`는 `LineBreakLayoutCandidate[]`를 반환합니다. 각 후보는 `{ breaks }` 형태이며,
Core가 이를 측정해 `LineBreakLayout`으로 만든 뒤 `nativeLayout`과 함께 `select`에
전달합니다.

```ts
import {
  balance,
  consensus,
  createLineBreakStrategy,
  greedy,
} from "@semantic-wrap/core";

const consensusStrategy = createLineBreakStrategy({
  aggregate: consensus({ minimumModels: 2 }),
  select: balance({ tolerance: 0.12 }),
});

const greedyStrategy = createLineBreakStrategy({
  calculate: greedy(),
});
```

`lowestPenalty()`는 각 경계에서 가장 낮은 비용의 예측을 사용하며 기본값입니다. 기본
`calculate` 단계인 `optimalLayouts()`는 최소 줄 수를 만족하는 layout 중 균형 점수와
모델 비용이 서로 지배하지 않는 후보들을 반환합니다. `greedy()`는 현재 줄에 들어가는
후보 중 비용이 가장 낮은 경계를 차례로 선택해 하나의 후보만 반환합니다.

기본 `select` 단계인 `balance()`는 정상적인 native layout을 모델 근거 없이 변경하지
않습니다. overflow가 없고 줄 수가 같으며 `modelCost`가 native보다 낮은 후보만 변경
대상으로 인정합니다. 그런 후보가 없으면 native를 유지합니다.

모델 비용이 개선된 후보가 있으면 native와 함께 시각적 균형을 비교합니다. `tolerance`
기본값은 `0.12`이며, 값이 클수록 최상의 균형에서 더 멀어진 layout도 허용합니다. native가
overflow라면 모델 비용 개선 여부와 관계없이 너비 안에 들어오는 calculated layout을
선택할 수 있습니다. `nativeLayout`이 없으면 calculated 후보들 안에서 기존 방식대로
선택합니다.

다음 예시는 `calculate` 단계만 바꿔 제목을 두 줄로 나누되 마지막 줄에 한 어절만 남는
후보를 제외합니다.

```ts
import {
  createLineBreakStrategy,
  selectLineBreaks,
  type LineBreakCalculator,
} from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";

const canvasContext = document.createElement("canvas").getContext("2d")!;
canvasContext.font = "700 28px system-ui";

const twoLineTitleCalculator: LineBreakCalculator = ({
  text,
  candidates,
  maxWidth,
  measureText,
}) => {
  let best: { offset: number; score: number } | undefined;

  for (const candidate of candidates) {
    const firstLine = text.slice(0, candidate.offset).trimEnd();
    const lastLine = text.slice(candidate.offset).trimStart();
    const firstWidth = measureText(firstLine);
    const lastWidth = measureText(lastLine);

    if (firstWidth > maxWidth || lastWidth > maxWidth) continue;
    if (lastLine.split(/\s+/u).length < 2) continue;

    const imbalance = Math.abs(firstWidth - lastWidth) / maxWidth;
    const score = candidate.penalty + imbalance;
    if (!best || score < best.score) {
      best = { offset: candidate.offset, score };
    }
  }

  return [{ breaks: best ? [best.offset] : [] }];
};

const twoLineTitleStrategy = createLineBreakStrategy({
  calculate: twoLineTitleCalculator,
});

const title = "좋은 사용자 경험을 만들기 위해 놓치지 말아야 할 기준";
const measureText = (value: string) => canvasContext.measureText(value).width;
const input = {
  text: title,
  model: koTitleModel,
  maxWidth: 360,
  measureText,
};

const defaultResult = selectLineBreaks(input);
const customResult = selectLineBreaks(input, {
  strategy: twoLineTitleStrategy,
});

console.log(defaultResult.lines);
// ["좋은 사용자 경험을 만들기", "위해 놓치지 말아야 할 기준"]

console.log(customResult.lines);
// ["좋은 사용자 경험을 만들기 위해", "놓치지 말아야 할 기준"]
```

#### Diagnostics

후보 통합 규칙을 조정하거나 결과를 분석할 때는 `diagnostics: true`를 사용합니다.

```ts
import { selectLineBreaks } from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";

const canvasContext = document.createElement("canvas").getContext("2d")!;
canvasContext.font = "700 28px system-ui";

const result = selectLineBreaks(
  {
    text: "더 나은 사용자",
    model: koTitleModel,
    maxWidth: 320,
    measureText: (text) => canvasContext.measureText(text).width,
  },
  { diagnostics: true },
);

console.log(result.diagnostics.predictions);
// 모델 level별 원본 예측

console.log(result.diagnostics.candidates);
// aggregate 단계가 만든 최종 후보
```

| 필드 | 설명 |
| --- | --- |
| `predictions` | 각 model level이 예측한 원본 경계. 같은 offset이 여러 번 나타날 수 있습니다. |
| `candidates` | `aggregate` 단계가 계산에 사용할 하나의 후보 목록으로 통합한 결과 |
| `calculatedLayouts` | `calculate` 단계가 만든 layout 후보 목록. 각 후보에는 `lineCount`, `balanceScore`, `modelCost`, `overflow`가 포함됩니다. |
| `nativeLayout` | 전달된 기존 줄바꿈을 측정한 layout |
| `selection` | `select` 단계가 선택한 layout의 출처·인덱스와 이유 |

기본 `balance()`는 모델 비용이 개선되지 않아 native를 유지할 때
`native-no-model-improvement`를 반환합니다. 그 밖의 기본 reason은 `native-selected`와
`calculated-selected`이며, custom selector는 별도의 reason을 반환할 수 있습니다.

### `@semantic-wrap/react`

`@semantic-wrap/react`는 화면에 렌더링된 글꼴과 너비를 측정하고, Core가 선택한
줄바꿈을 React 엘리먼트에 적용합니다. 저수준 API인 `useSemanticWrap`이 측정과 선택
결과를 제공하고, `SemanticWrap`은 plain-text 엘리먼트에 그 결과를 바로 적용하는
편의 컴포넌트입니다. 대부분은 `SemanticWrap`으로 시작하고, markup을 직접 구성해야
할 때 hook을 사용하면 됩니다.

#### `SemanticWrap`

`SemanticWrap`에는 하나의 plain-text React 엘리먼트를 전달합니다. 별도의 wrapper를
추가하지 않으며 기존 props도 그대로 유지합니다. 자식 엘리먼트는 실제 `HTMLElement`로
ref를 전달할 수 있어야 합니다.

| Prop | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `children` | 예 | - | 하나의 plain-text React 엘리먼트 |
| `model` | 예 | - | 줄바꿈 후보를 만드는 모델 |
| `strategy` | 아니요 | 기본 strategy | 후보 통합, layout 후보 계산, 최종 선택 규칙 |
| `mode` | 아니요 | `"precise"` | `"precise"`는 정확한 최초 결과를 기다리고, `"progressive"`는 native SSR을 즉시 표시한 뒤 첫 viewport 또는 element resize부터 precise로 동작 |
| `ref` | 아니요 | - | 자식과 함께 사용할 `HTMLElement` ref |

```tsx
<SemanticWrap mode="progressive" model={koTitleModel}>
  <h1>{title}</h1>
</SemanticWrap>
```

두 모드 모두 보이지 않는 DOM copy에서 측정하고 ResizeObserver 안에서 최종 결과만
동기적으로 반영합니다. 측정을 위해 visible element를 비우거나 원문으로 되돌리지
않습니다.

Chakra UI처럼 ref를 전달하는 컴포넌트나 Tailwind CSS로 스타일을 적용한 엘리먼트도
같은 방식으로 사용할 수 있습니다.

##### Chakra UI

```tsx
import { Text } from "@chakra-ui/react";
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "@semantic-wrap/react";

<SemanticWrap model={koTitleModel}>
  <Text textStyle="heading2">{title}</Text>
</SemanticWrap>
```

##### Tailwind CSS

```tsx
import { createLineBreakStrategy, greedy } from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "@semantic-wrap/react";

const greedyStrategy = createLineBreakStrategy({
  calculate: greedy(),
});

<SemanticWrap model={koTitleModel} strategy={greedyStrategy}>
  <h2 className="text-3xl font-bold leading-tight">{title}</h2>
</SemanticWrap>
```

#### `useSemanticWrap`

선택된 줄을 직접 렌더링하거나 diagnostics를 확인하려면 `useSemanticWrap`을
사용합니다. 측정에는 대상 엘리먼트의 계산된 텍스트 스타일을 사용합니다. 내부
markup에 서로 다른 글꼴이나 크기를 적용한다면 그 스타일을 반영한 `measureText`와
Core를 직접 사용하세요.

| 옵션 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `text` | 예 | - | 측정하고 나눌 원문 |
| `model` | 예 | - | 줄바꿈 후보를 만드는 모델 |
| `strategy` | 아니요 | 기본 strategy | 후보 통합, layout 후보 계산, 최종 선택 규칙 |
| `diagnostics` | 아니요 | `false` | 예측과 단계별 중간 결과를 함께 반환할지 여부 |

출력: `UseSemanticWrapResult`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `ref` | `(element: HTMLElement \| null) => void` | 측정할 엘리먼트에 연결하는 callback ref |
| `selection` | `LineBreakSelection \| null` | 아직 측정하지 않았으면 `null`, 측정 후에는 선택 결과 |
| `diagnostics` | `LineBreakDiagnostics \| null` | 진단을 요청하지 않았거나 아직 측정 전이면 `null` |

Hook은 선택 결과를 markup에 직접 적용하지 않습니다. 다음 예시는 선택된 각 줄 사이에
` / `를 넣어 결과를 표시합니다.

```tsx
import { koTitleModel } from "@semantic-wrap/ko";
import { useSemanticWrap } from "@semantic-wrap/react";

export function BreakPreview({ title }: { title: string }) {
  const { ref, selection } = useSemanticWrap({
    text: title,
    model: koTitleModel,
  });
  const preview = selection ? selection.lines.join(" / ") : title;

  return <h1 ref={ref}>{preview}</h1>;
}
```

`useSemanticWrap`은 CSS를 변경하지 않습니다. `SemanticWrap`의 precise 모드는 최초
선택 전 opacity만 일시적으로 변경합니다. 기존 CSS는 비교 대상인 브라우저의 줄바꿈에
반영되며, 모델 결과가 선택되면 `<br>`로 줄바꿈을 적용합니다.

### `@semantic-wrap/ko`

`@semantic-wrap/ko`는 한국어 제목을 위해 학습된 `koTitleModel`을 제공합니다.

```ts
import { koTitleModel } from "@semantic-wrap/ko";
```

이 모델은 공백 경계만 사용하므로 어절 내부에 임의의 줄바꿈 후보를 만들지 않습니다.

> [!WARNING]
> `@semantic-wrap/ko`는 소규모 데이터셋으로 학습한 실험적 프리셋입니다. 정확도를
> 높이려면 실제 사용 환경을 대표하는 대규모 데이터셋으로 학습하고 검증한 모델을
> 권장합니다. 자세한 내용은
> [Model Card](./packages/ko/MODEL_CARD.md)를 참고하세요.

영어 제목에는 `@semantic-wrap/en`의 `enTitleModel`을 사용할 수 있습니다. 이 모델도
소규모 데이터셋으로 학습한 실험적 프리셋이며, 자세한 내용은 영어
[Model Card](./packages/en/MODEL_CARD.md)를 참고하세요.

## 개발

```sh
bun install
bun run check
```

`bun run check`는 타입 검사, 단위 테스트, 빌드, Chromium·Firefox·WebKit 브라우저
테스트와 npm 패키지 구성을 차례로 확인합니다.

## 배포

네 패키지는 의존성 순서대로 배포합니다.

```sh
bun run check
bun run publish:core
bun run publish:en
bun run publish:ko
bun run publish:react
```

## 라이선스

Apache-2.0. `@semantic-wrap/core`에는 Google의 BudouX Parser를 수정한
dependency-free model inference가 포함되어 있습니다. 자세한 내용은
[NOTICE](./NOTICE)를 참고하세요.
