# @semantic-wrap/react

[English](./README.md) | 한국어

`@semantic-wrap/react`는 실제 DOM의 글꼴과 너비를 측정하고, Core가 브라우저의
줄바꿈과 계산된 layout 후보들 중 선택한 결과를 `<br>`로 렌더링합니다.

## 설치

```sh
npm install @semantic-wrap/core @semantic-wrap/react @semantic-wrap/ko react react-dom
```

React와 React DOM 19 이상이 peer dependency로 필요합니다.
이 패키지는 ESM 전용입니다.

## 사용 예시

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

`SemanticWrap`은 별도 wrapper를 추가하지 않습니다. 자식은 하나의 plain-text React
element여야 하고 실제 `HTMLElement`로 ref를 전달해야 합니다. `model`은 필수이며,
Core의 기본 동작을 바꾸려면 `strategy`를 선택적으로 전달합니다.

기본값인 precise 모드는 SSR 원문을 HTML에 유지하되 최초의 정확한 layout이 준비될
때까지 자식의 opacity를 잠시 0으로 둡니다. 첫 화면의 semantic 정확도보다 즉시 LCP가
중요하면 progressive 모드를 사용합니다.

```tsx
<SemanticWrap mode="progressive" model={koTitleModel}>
  <h1>{title}</h1>
</SemanticWrap>
```

progressive는 최초에 원문을 그대로 렌더링하고 첫 viewport 또는 element resize부터
영구적으로 precise 파이프라인을 사용합니다. 두 모드 모두 보이지 않는 copy에서 native
layout을 측정하고 resize 중에는 최종 결과만 동기적으로 반영합니다.

### Chakra UI

```tsx
import { Text } from "@chakra-ui/react";
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "@semantic-wrap/react";

<SemanticWrap model={koTitleModel}>
  <Text textStyle="heading2">{title}</Text>
</SemanticWrap>
```

### Tailwind CSS

```tsx
import { createLineBreakStrategy, greedy } from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "@semantic-wrap/react";

const greedyStrategy = createLineBreakStrategy({ calculate: greedy() });

<SemanticWrap model={koTitleModel} strategy={greedyStrategy}>
  <h2 className="text-3xl font-bold leading-tight">{title}</h2>
</SemanticWrap>
```

선택된 layout을 직접 렌더링하거나 확인하려면 hook을 사용하세요. 측정에는 대상
엘리먼트의 계산된 텍스트 스타일을 사용합니다. 내부 markup에 서로 다른 글꼴이나
크기를 적용한다면 그 스타일을 반영한 `measureText`와 Core를 직접 사용하세요.

```tsx
const { ref, selection, diagnostics } = useSemanticWrap({
  text: title,
  model: koTitleModel,
  diagnostics: true,
});
```

`useSemanticWrap`은 측정용 `ref`, 선택 결과, 선택적인 diagnostics를 반환하며 대상
엘리먼트의 children, 원문, CSS를 변경하지 않습니다.

## 라이선스

Apache-2.0.
