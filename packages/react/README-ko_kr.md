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

## 최초 표시와 업데이트 정책

| 옵션 | 기본값 | 대안 |
| --- | --- | --- |
| `initial` | `"resolved"`: 최초 계산 완료까지 숨김 | `"native"`: 원문 표시 후 자동 분할 계산 |
| `resize` | `"immediate"`: 동기 계산·즉시 적용 | `"settled"`: 분할 계산·너비 안정 후 적용 |

네 조합 모두 같은 정확한 계산과 native 비교를 사용합니다.

```tsx
<SemanticWrap initial="native" resize="settled" model={koTitleModel}>
  <p>{text}</p>
</SemanticWrap>
```

`native`는 원문이 먼저 표시될 기회를 준 다음 자동으로 계산을 시작합니다.
리사이즈를 기다리지 않으며 최초 결과에는 별도 100ms 대기를 넣지 않습니다.
최초 계산 도중 너비가 바뀌면 이전 작업을 취소하고 선택한 리사이즈 정책을 적용합니다.
`settled`는 원문을 계속 보여주며 약 4ms 단위로 계산하고, 너비가 약 100ms 동안
안정되고 계산이 끝나면 최신 결과만 적용합니다. `immediate`에는 이 대기가 없습니다.

텍스트 변경에는 최초 표시 정책을, 폰트·스타일 변경에는 업데이트 정책을 적용합니다.
같은 텍스트와 측정 조건에서 모델·전략 참조만 바뀌면 기존 표시를 유지하며 재검증합니다.
줄바꿈 위치뿐 아니라 후보 메타데이터와 diagnostics를 포함해 결과가 달라질 때만 갱신합니다.
옵션 변경과 unmount는 이전 작업을 취소합니다. SSR에서도 `resolved`는
원문을 HTML에 유지하되 opacity를 0으로 두고, `native`는 원문을 표시한 뒤 hydration에서
자동 계산을 시작합니다. 별도의 DOM wrapper는 추가하지 않습니다.

### 기존 mode에서 전환

`mode`와 `SemanticWrapMode`는 deprecated이며 호환성은 유지합니다.

- `mode="precise"`는 `initial="resolved" resize="immediate"`와 같습니다.
- `mode="progressive"`는 첫 viewport/element resize까지 원문만 보여주고 이후 동기
  계산하는 기존 동작을 유지합니다. 자동 계산하는 새 `initial="native"`와는 다릅니다.
- `mode`와 새 옵션의 혼용은 TypeScript와 런타임에서 거부합니다.
- 중간 구현인 `57f73fd`의 안정 후 적용 방식은 `resize="settled"`로 명시적으로 선택합니다.
  기본값은 그 이전의 즉시 적용 방식으로 복원됩니다.

구간별 실측 너비는 측정 조건별로 최대 65,536개 재사용합니다. 글꼴 조건 변경과
unmount에서 무효화됩니다. 4ms는 작업 목표이며 개별 DOM 연산과 사용자 제공 동기
콜백은 중간에 멈출 수 없습니다. 최종 결과는 100ms보다 늦게 완료될 수 있습니다.
모델·전략 참조를 안정적으로 유지하면 중복 계산을 줄이지만, 메모이제이션이 정상 동작의
필수 조건은 아닙니다. 콜백은 같은 입력에 같은 결과를 반환해야 합니다.

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
  initial: "native",
  resize: "settled",
});
```

`useSemanticWrap`은 측정용 `ref`, 선택 결과, 선택적인 diagnostics를 반환하며 대상
엘리먼트의 children, 원문, CSS를 변경하지 않습니다. 같은 initial/resize 옵션으로 실행
시점을 선택합니다. 최초 계산이나 텍스트·측정 조건 변경에 따른 분할 계산 대기 중에는
selection과 diagnostics가 null이며 이때 원문을 렌더링하세요. 참조만 변경된 재검증에서는
기존 결과를 유지합니다. 최초 표시를 숨길지 여부도 Hook 사용자가 직접 결정합니다.

## 긴 입력에서 주변 탐색 사용하기

기본 전체 탐색은 정확한 DOM 너비 측정을 자동으로 묶어 처리합니다. 제한된 수의 숨겨진
측정 요소를 재사용하며, 기존 후보와 선택 규칙을 유지합니다. 별도 설정은 필요하지 않습니다.
스타일 등이 바뀌어 캐시가 무효화되거나 unmount되면 측정 요소를 제거합니다.
아래 주변 탐색은 품질과 속도를 교환하는 별도의 선택 옵션입니다.

```tsx
import { createLineBreakStrategy, nearbyLayouts } from "@semantic-wrap/core";

const strategy = createLineBreakStrategy({ calculate: nearbyLayouts() });

<SemanticWrap model={koTitleModel} strategy={strategy}>
  <p>{longText}</p>
</SemanticWrap>
```

기본 줄바꿈 주변만 실제 너비로 측정합니다. 기존 전체 탐색보다 좋은 조합을 놓칠 수
있으므로 기본값은 변경하지 않았습니다. 같은 strategy를 `useSemanticWrap`에도 전달할
수 있습니다. 긴 입력에서 60fps 리사이즈를 보장하는 옵션은 아닙니다.

## 라이선스

Apache-2.0.
