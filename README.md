<div align="center">
  <img src="./assets/semantic-wrap.webp" alt="semantic-wrap" />
  <p>
    <a href="https://www.npmjs.com/package/@semantic-wrap/core"><img src="https://img.shields.io/npm/v/@semantic-wrap/core.svg?style=flat-square&colorA=000&colorB=000" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/@semantic-wrap/core"><img src="https://img.shields.io/npm/dm/@semantic-wrap/core.svg?style=flat-square&colorA=000&colorB=000" alt="npm downloads" /></a>
    <a href="https://github.com/woohyun-park/semantic-wrap"><img src="https://img.shields.io/github/stars/woohyun-park/semantic-wrap?style=flat-square&colorA=000&colorB=000" alt="GitHub stars" /></a>
    <a href="https://github.com/woohyun-park/semantic-wrap/blob/main/LICENSE"><img src="https://img.shields.io/github/license/woohyun-park/semantic-wrap?style=flat-square&colorA=000&colorB=000" alt="Apache-2.0 License" /></a>
  </p>
  <p><a href="./README-en_us.md">English</a> | 한국어</p>
</div>

## semantic-wrap이란?

`semantic-wrap`은 한국어 제목처럼 짧고 크게 표시하는 텍스트를 의미 단위에 맞춰
줄바꿈하는 JavaScript 라이브러리입니다. 브라우저가 만든 줄바꿈과 의미 경계 후보를
실제 렌더링 너비로 비교하고, 더 나은 후보가 있을 때만 `<br>`를 적용합니다.

## 사용 예시

같은 너비에서도 함께 읽어야 할 표현을 다음 줄로 넘기지 않도록 조정할 수 있습니다.
실제 결과는 글꼴과 너비에 따라 달라집니다.

| Native CSS | semantic-wrap |
| --- | --- |
| 자금 지원 계획 문서를 제출한<br>후 확인하는 이유는 무엇입니까? | 자금 지원 계획 문서를 제출한 후<br>확인하는 이유는 무엇입니까? |
| 모바일 환경에서 읽기<br>좋은 제목을 만드는 방법 | 모바일 환경에서<br>읽기 좋은 제목을 만드는 방법 |
| 효율적인 회의를 만들기<br>위해 버려야 할 습관 | 효율적인 회의를<br>만들기 위해 버려야 할 습관 |

```tsx
import { balanceSelector } from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "@semantic-wrap/react";

const titleSelector = balanceSelector({ tolerance: 0.12 });

export function Title({ children }: { children: string }) {
  return (
    <SemanticWrap model={koTitleModel} selector={titleSelector}>
      <h1 className="title">{children}</h1>
    </SemanticWrap>
  );
}
```

`SemanticWrap`은 자식 엘리먼트를 그대로 사용합니다. 별도 DOM이나 CSS를 추가하지
않고, 선택된 줄바꿈만 `<br>`로 렌더링합니다.

```css
.title {
  overflow-wrap: anywhere;
  text-wrap: balance;
  word-break: keep-all;
}
```

라이브러리는 `text-wrap`, `word-break`, `overflow-wrap`을 설정하거나 덮어쓰지
않습니다. Semantic 후보가 선택되면 `<br>`가 hard break가 되고, 위 CSS 속성은 각
hard line 안의 추가 wrapping에 적용됩니다. Native 후보가 유지되면 브라우저 CSS가
전체 줄바꿈을 담당합니다.

## 설치

React에서 한국어 프리셋을 사용하려면 세 패키지를 함께 설치합니다.

```sh
npm install @semantic-wrap/core @semantic-wrap/react @semantic-wrap/ko react
```

`@semantic-wrap/react`을 사용하려면 React 19 이상이 필요합니다. Core 또는 모델만
사용하는 환경에는 React가 필요하지 않습니다.

## 패키지

| 패키지 | 역할 |
| --- | --- |
| `@semantic-wrap/core` | 의미 경계 후보 생성, 레이아웃 비교, selector API |
| `@semantic-wrap/ko` | 한국어 제목용 실험적 phrase model |
| `@semantic-wrap/react` | DOM 측정과 `<br>` 렌더링을 담당하는 React adapter |

## 동작 방식

1. Phrase model이 텍스트에서 줄바꿈 후보와 각 후보의 의미 비용을 만듭니다.
2. Selector가 실제 글꼴과 너비로 후보 레이아웃을 측정하고 Native 레이아웃과
   비교합니다.
3. 더 나은 Semantic 후보가 선택되면 React adapter가 `<br>`를 렌더링합니다.
   그렇지 않으면 원문을 그대로 두어 브라우저에 줄바꿈을 맡깁니다.

엘리먼트 크기가 달라지거나 웹 폰트 로딩이 끝나면 다시 측정하므로 반응형 레이아웃과
함께 사용할 수 있습니다.

## React API

### `SemanticWrap`

Chakra UI나 Tailwind CSS에서도 스타일을 가진 엘리먼트 바깥을 감싸면 됩니다.

#### Chakra UI

```tsx
import { Text } from "@chakra-ui/react";
import { balanceSelector } from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "@semantic-wrap/react";

const titleSelector = balanceSelector();

<SemanticWrap model={koTitleModel} selector={titleSelector}>
  <Text textStyle="heading2">{title}</Text>
</SemanticWrap>
```

#### Tailwind CSS

```tsx
import { greedySelector } from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "@semantic-wrap/react";

<SemanticWrap model={koTitleModel} selector={greedySelector()}>
  <h2 className="text-3xl font-bold leading-tight">{title}</h2>
</SemanticWrap>
```

자식은 하나의 plain-text React element여야 하며 실제 `HTMLElement`로 ref를 전달해야
합니다.

### `useSemanticWrap`

링크나 강조처럼 내부 markup이 있는 제목은 hook의 선택 결과를 애플리케이션 방식으로
렌더링합니다.

```tsx
const { ref, selection } = useSemanticWrap({
  text: title,
  model: koTitleModel,
  selector: titleSelector,
});
```

Hook은 `ref`와 선택 결과만 반환하며 대상 엘리먼트의 children, 원문, CSS를 변경하지
않습니다.

## Headless core

React 없이 후보 생성과 줄바꿈 선택을 직접 사용할 수도 있습니다.

```ts
import {
  balanceSelector,
  getBreakCandidates,
  selectLineBreaks,
} from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";

const text = "더 나은 사용자 경험을 만드는 방법";
const candidates = getBreakCandidates(text, koTitleModel);

const result = selectLineBreaks({
  text,
  candidates,
  maxWidth: 320,
  measureText: (value) => canvasContext.measureText(value).width,
  selector: balanceSelector({ tolerance: 0.12 }),
});

console.log(result.lines, result.breaks);
```

`nativeLayout`을 전달하면 실제 브라우저의 줄바꿈과 비교합니다. 생략하면 core가 가장
균형 잡힌 레이아웃을 baseline으로 계산합니다. React adapter는 보이지 않는 측정
엘리먼트를 사용해 Native 레이아웃을 자동으로 전달합니다.

## Selector

- `balanceSelector`는 시각적 균형 허용치 안에서 의미 비용이 낮은 후보를 찾습니다.
  Native와 결과가 다를 때만 선택한 경계를 적용합니다.
- `greedySelector`는 각 줄을 왼쪽부터 채우면서 현재 너비에 들어오는 경계 중 의미
  비용이 가장 낮은 경계를 우선합니다.

`balanceSelector`의 `tolerance`는 의미를 위해 허용할 시각적 불균형의 범위입니다.
기본값은 `0.12`입니다.

제품별 정책이 필요하면 selector를 교체할 수 있습니다.

```ts
const productSelector: LineBreakSelector = ({ candidates }) => {
  const preferred = candidates.find((candidate) => candidate.name === "product-rule");
  return {
    breaks: preferred ? [preferred.offset] : [],
    reason: "product-rule",
  };
};
```

Custom selector로 줄 수 제한, orphan 감점, 금지 경계 또는 디자인 시스템별 비용
함수를 구현할 수 있습니다.

## Custom phrase model

모델 단계는 coarse, medium, fine으로 고정되지 않습니다. 하나부터 임의 개수까지
사용할 수 있고, 같은 경계를 여러 모델이 예측하면 가장 낮은 penalty가 적용됩니다.

```ts
const myModel: PhraseModel = {
  schemaVersion: 1,
  boundaryMode: "spaces",
  levels: [
    { name: "coarse", model: coarseBudouxModel, penalty: 0 },
    { name: "medium", model: mediumBudouxModel, penalty: 0.35 },
    { name: "fine", model: fineBudouxModel, penalty: 0.7 },
  ],
  fallbackPenalty: 1,
};
```

- `penalty`: 해당 모델이 허용한 경계에서 줄을 나누는 상대 비용
- `fallbackPenalty`: 어떤 모델도 선택하지 않은 일반 경계의 비용
- `boundaryMode: "spaces"`: 공백 경계만 사용
- `boundaryMode: "characters"`: UTF-16을 보존한 문자 경계를 사용

한국어 프리셋은 공백 경계만 사용하므로 모델이 어절 내부 경계를 임의로 만들지
않습니다.

## 한국어 프리셋 상태

> [!WARNING]
> `@semantic-wrap/ko`는 소규모 데이터셋으로 학습한 실험적 프리셋입니다. 정확도를
> 높이려면 실제 사용 환경을 대표하는 대규모 데이터셋으로 학습하고 검증한 모델을
> 권장합니다. 자세한 내용은
> [Model Card](./packages/ko/MODEL_CARD.md)를 참고하세요.

## 개발

```sh
bun install
bun run check
```

`bun run check`는 타입 검사, 단위 테스트, 빌드, Chromium 브라우저 테스트와 npm
패키지 구성을 차례로 확인합니다.

## 배포

세 패키지는 의존성 순서대로 배포합니다.

```sh
bun run check
bun run publish:core
bun run publish:ko
bun run publish:react
```

## 라이선스

Apache-2.0. `@semantic-wrap/core`에는 Google의 BudouX Parser를 수정한
dependency-free model inference가 포함되어 있습니다. 자세한 내용은
[NOTICE](./NOTICE)를 참고하세요.
