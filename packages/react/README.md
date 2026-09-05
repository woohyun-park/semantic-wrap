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
in an invisible copy. After its initial synchronous selection, precise renders the source
with native wrapping during resize and computes the latest result in cooperative slices.
It commits once the width has been stable for about 100 ms and calculation is complete.
`useSemanticWrap` returns a null selection while resize work is pending. Progressive keeps
its existing synchronous resize behavior.

Exact segment widths are reused across container widths, with at most 65,536 offset-keyed
entries per plan/metric identity. Typography changes and unmount invalidate the cache.
The approximately 4 ms work budget is cooperative, not a hard deadline: individual browser
operations and custom synchronous predictors/calculators/selectors cannot be interrupted.
Custom calculators can supply a synchronous `steps` iterator for cooperative execution.

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

The default global search batches exact DOM text measurements automatically, using a
bounded pool of reusable hidden elements. It keeps the existing candidate space and
selection rules; no configuration is required. Probes are released on invalidation and
unmount.

## Faster local search for long text

```tsx
import { createLineBreakStrategy, nearbyLayouts } from "@semantic-wrap/core";

const nearbyStrategy = createLineBreakStrategy({ calculate: nearbyLayouts() });

<SemanticWrap model={enTitleModel} strategy={nearbyStrategy}>
  <p>{longText}</p>
</SemanticWrap>
```

React supplies the measured native breaks automatically. This opt-in calculator searches
near native line endings using exact substring measurements. It can substantially reduce
work on long text, but can miss improvements found by the default global search; it is not
a guarantee of identical wrapping or smooth 60fps resizing. The default remains
`optimalLayouts()`. The same `strategy` works with `useSemanticWrap`.

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
