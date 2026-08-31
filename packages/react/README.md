# @semantic-wrap/react

`@semantic-wrap/react`는 실제 DOM의 글꼴과 너비를 측정해 semantic line break를
선택하고 `<br>`로 렌더링하는 headless React adapter입니다.

## 설치

```sh
npm install @semantic-wrap/core @semantic-wrap/react @semantic-wrap/ko react
```

React 19 이상이 peer dependency로 필요합니다.

## 사용 예시

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

```css
.title {
  overflow-wrap: anywhere;
  text-wrap: balance;
  word-break: keep-all;
}
```

`SemanticWrap`은 자식 엘리먼트를 그대로 사용하며 별도 wrapper나 CSS를 추가하지
않습니다. 자식은 하나의 plain-text React element여야 하고 실제 `HTMLElement`로
ref를 전달해야 합니다.

### Chakra UI

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

### Tailwind CSS

```tsx
import { greedySelector } from "@semantic-wrap/core";
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "@semantic-wrap/react";

<SemanticWrap model={koTitleModel} selector={greedySelector()}>
  <h2 className="text-3xl font-bold leading-tight">{title}</h2>
</SemanticWrap>
```

링크나 강조처럼 내부 markup이 있는 제목은 hook의 선택 결과를 애플리케이션 방식으로
렌더링하세요.

```tsx
const { ref, selection } = useSemanticWrap({
  text: title,
  model: koTitleModel,
  selector: titleSelector,
});
```

`useSemanticWrap`은 `ref`와 선택 결과만 반환하며 대상 엘리먼트의 children, 원문,
CSS를 변경하지 않습니다.

## 라이선스

Apache-2.0.
