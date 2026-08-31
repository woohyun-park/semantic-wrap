# @semantic-wrap/core

`@semantic-wrap/core`는 의미 경계 후보를 만들고 실제 텍스트 너비에 맞는 줄바꿈을
선택하는 dependency-free engine입니다.

## 사용 예시

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

브라우저에서 자동 측정하고 `<br>`까지 렌더링하려면 `@semantic-wrap/react`을 함께
사용하세요. 한국어 프리셋은 `@semantic-wrap/ko`에서 제공합니다.

## 공개 API

- `getBreakCandidates`
- `selectLineBreaks`
- `balanceSelector`
- `greedySelector`
- Selector와 phrase model을 구성하는 public types

## 라이선스

Apache-2.0. 수정된 Google BudouX Parser에 관한 고지는 [NOTICE](./NOTICE)를
참고하세요.
