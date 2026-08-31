<div align="center">
  <img src="./assets/semantic-wrap.webp" alt="semantic-wrap" />
  <p>
    <a href="https://www.npmjs.com/package/@semantic-wrap/core"><img src="https://img.shields.io/npm/v/@semantic-wrap/core.svg?style=flat-square&colorA=000&colorB=000" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/@semantic-wrap/core"><img src="https://img.shields.io/npm/dm/@semantic-wrap/core.svg?style=flat-square&colorA=000&colorB=000" alt="npm downloads" /></a>
    <a href="https://github.com/woohyun-park/semantic-wrap"><img src="https://img.shields.io/github/stars/woohyun-park/semantic-wrap?style=flat-square&colorA=000&colorB=000" alt="GitHub stars" /></a>
    <a href="https://github.com/woohyun-park/semantic-wrap/blob/main/LICENSE"><img src="https://img.shields.io/github/license/woohyun-park/semantic-wrap?style=flat-square&colorA=000&colorB=000" alt="Apache-2.0 License" /></a>
  </p>
  <p>English | <a href="./README.md">한국어</a></p>
</div>

## What is semantic-wrap?

`semantic-wrap` is a JavaScript library for breaking short display text, such as Korean
headings, at meaningful boundaries. It compares the browser's native wrapping with semantic
boundary candidates at the actual rendered width and inserts `<br>` elements only when it
finds a better layout.

## Examples

Text that should be read together can stay on the same line even under the same width
constraint. The actual result depends on the font and available width.

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

`SemanticWrap` preserves its child element. It adds no wrapper or CSS and renders only the
selected line breaks as `<br>` elements.

```css
.title {
  overflow-wrap: anywhere;
  text-wrap: balance;
  word-break: keep-all;
}
```

The library does not set or override `text-wrap`, `word-break`, or `overflow-wrap`. When a
semantic candidate is selected, each `<br>` becomes a hard break and these CSS properties
apply to any additional wrapping within each hard line. When the native candidate is kept,
the browser handles the entire layout.

## Installation

Install all three packages to use the Korean preset with React.

```sh
npm install @semantic-wrap/core @semantic-wrap/react @semantic-wrap/ko react
```

React 19 or later is required when using `@semantic-wrap/react`. Projects that use only the
core or a model do not need React.

## Packages

| Package | Purpose |
| --- | --- |
| `@semantic-wrap/core` | Semantic boundary generation, layout comparison, and selector APIs |
| `@semantic-wrap/ko` | Experimental phrase model for Korean titles |
| `@semantic-wrap/react` | React adapter for DOM measurement and `<br>` rendering |

## How it works

1. A phrase model generates line-break candidates and assigns a semantic cost to each one.
2. A selector measures candidate layouts with the actual font and width, then compares them
   with the native layout.
3. When a better semantic candidate is found, the React adapter renders `<br>` elements.
   Otherwise, it leaves the source text unchanged and lets the browser wrap it.

The adapter measures again when the element is resized or its web fonts finish loading, so it
works with responsive layouts.

## React API

### `SemanticWrap`

Wrap the styled element when using Chakra UI or Tailwind CSS.

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

The child must be a single plain-text React element that forwards its ref to an actual
`HTMLElement`.

### `useSemanticWrap`

For headings with nested markup such as links or emphasis, use the hook and render its result
in your application.

```tsx
const { ref, selection } = useSemanticWrap({
  text: title,
  model: koTitleModel,
  selector: titleSelector,
});
```

The hook returns only a `ref` and the selected layout. It does not change the element's
children, source text, or CSS.

## Headless core

Candidate generation and line-break selection can also be used without React.

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

Pass `nativeLayout` to compare against the browser's actual wrapping. When omitted, the core
uses the most visually balanced layout as its baseline. The React adapter supplies the native
layout automatically through an invisible measurement element.

## Selectors

- `balanceSelector` finds the lowest-cost semantic candidate within the allowed visual-balance
  tolerance. It applies the selected boundaries only when they differ from the native layout.
- `greedySelector` fills each line from left to right and prioritizes the lowest-cost semantic
  boundary that fits within the current width.

The `tolerance` option controls how much visual imbalance `balanceSelector` may accept in favor
of a semantic boundary. Its default value is `0.12`.

You can replace the selector when your product needs a different policy.

```ts
const productSelector: LineBreakSelector = ({ candidates }) => {
  const preferred = candidates.find((candidate) => candidate.name === "product-rule");
  return {
    breaks: preferred ? [preferred.offset] : [],
    reason: "product-rule",
  };
};
```

A custom selector can implement line limits, orphan penalties, forbidden boundaries, or a
design-system-specific cost function.

## Custom phrase models

Model levels are not limited to coarse, medium, and fine. A model can contain any number of
levels, and the lowest penalty wins when multiple levels predict the same boundary.

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

- `penalty`: the relative cost of breaking at a boundary allowed by that model
- `fallbackPenalty`: the cost of a normal boundary not selected by any model
- `boundaryMode: "spaces"`: allow only whitespace boundaries
- `boundaryMode: "characters"`: allow UTF-16-safe character boundaries

The Korean preset uses only whitespace boundaries, so it never inserts a break inside an
eojeol.

## Korean preset status

> [!WARNING]
> `@semantic-wrap/ko` is an experimental preset trained on a small dataset. For higher
> accuracy, use a model trained and validated on a large dataset representative of your
> production environment. See the [Model Card](./packages/ko/MODEL_CARD.md) for details.

## Development

```sh
bun install
bun run check
```

`bun run check` runs type checking, unit tests, the build, Chromium browser tests, and npm
package validation.

## Release

Publish the three packages in dependency order.

```sh
bun run check
bun run publish:core
bun run publish:ko
bun run publish:react
```

## License

Apache-2.0. `@semantic-wrap/core` includes a modified, dependency-free implementation of the
Google BudouX parser. See [NOTICE](./NOTICE) for details.
