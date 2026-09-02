# @semantic-wrap/react

English | [한국어](./README-ko_kr.md)

`@semantic-wrap/react` measures the rendered font, width, and native wrapping of a DOM
element. It passes that data to Core and renders the selected calculated layout as `<br>`
elements.

## Installation

```sh
npm install @semantic-wrap/core @semantic-wrap/react @semantic-wrap/en react react-dom
```

React and React DOM 19 or later are required as peer dependencies.
This package is ESM-only.

## `SemanticWrap`

```tsx
import { enTitleModel } from "@semantic-wrap/en";
import { SemanticWrap } from "@semantic-wrap/react";

export function Title({ children }: { children: string }) {
  return (
    <SemanticWrap model={enTitleModel}>
      <h1 className="title">{children}</h1>
    </SemanticWrap>
  );
}
```

`SemanticWrap` preserves its child element and adds no wrapper. Pass exactly one plain-text
React element that forwards its ref to an actual `HTMLElement`.

Precise mode is the default. It keeps the server-rendered text in the HTML but temporarily
sets the child opacity to zero until the first exact layout is ready. Use progressive mode
when immediate LCP is more important than semantic wrapping on the first viewport:

```tsx
<SemanticWrap mode="progressive" model={enTitleModel}>
  <h1>{title}</h1>
</SemanticWrap>
```

Progressive mode renders untouched native text initially and switches permanently to the
precise pipeline on the first viewport or element resize. Both modes measure native wrapping
in an invisible copy and synchronously commit only the final result during resize.

### Chakra UI

```tsx
import { Text } from "@chakra-ui/react";
import { enTitleModel } from "@semantic-wrap/en";
import { SemanticWrap } from "@semantic-wrap/react";

<SemanticWrap model={enTitleModel}>
  <Text textStyle="heading2">{title}</Text>
</SemanticWrap>
```

### Tailwind CSS

```tsx
import { createLineBreakStrategy, greedy } from "@semantic-wrap/core";
import { enTitleModel } from "@semantic-wrap/en";
import { SemanticWrap } from "@semantic-wrap/react";

const greedyStrategy = createLineBreakStrategy({ calculate: greedy() });

<SemanticWrap model={enTitleModel} strategy={greedyStrategy}>
  <h2 className="text-3xl font-bold leading-tight">{title}</h2>
</SemanticWrap>
```

## `useSemanticWrap`

Use the hook when your application needs to render or inspect the selected layout itself.
Measurement uses the target element's computed text style. If nested markup uses different
typography, use Core with a matching custom `measureText` function.

```tsx
const { ref, selection, diagnostics } = useSemanticWrap({
  text: title,
  model: enTitleModel,
  diagnostics: true,
});
```

The hook returns a measurement ref, the selected layout, and optional diagnostics. It does
not change the target element's children or CSS.

## License

Apache-2.0.
