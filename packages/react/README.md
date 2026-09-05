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

## Display and update scheduling

| Option | Default | Alternative |
| --- | --- | --- |
| `initial` | `"resolved"`: hide until the first exact selection | `"native"`: show source, then automatically calculate cooperatively |
| `resize` | `"immediate"`: synchronous calculation and application | `"settled"`: cooperative calculation and stable-width application |

All four combinations preserve the same exact selection and native comparison.

```tsx
<SemanticWrap initial="native" resize="settled" model={enTitleModel}>
  <p>{text}</p>
</SemanticWrap>
```

Native-first allows a source frame before starting work, without requiring a resize.
Its initial result is applied when ready, without an extra stability wait. If width changes
during startup, obsolete work is cancelled and the selected resize policy applies.
Settled updates keep source text visible, calculate in approximately 4 ms slices, and apply
only the latest result after about 100 ms of stable width and completed calculation.
Immediate updates do not introduce this wait.

Text changes restart the first-display policy. Font/style changes use the update policy.
At unchanged text and measurement conditions, new model/strategy references keep the displayed
result while revalidating; only changed results are published. This includes candidate metadata
and diagnostics, not just break offsets. Changing options or unmounting cancels pending work. Resolved-first SSR keeps
source text in HTML with zero opacity; native-first SSR is visible and hydration starts
automatic calculation. No additional DOM wrapper is introduced.

### Migration from mode

`mode` and `SemanticWrapMode` are deprecated, but supported:

- `mode="precise"` maps to `initial="resolved" resize="immediate"`.
- `mode="progressive"` retains its original behavior: native source until the first
  viewport/element resize, then synchronous updates. It is **not** an alias for the new
  automatic `initial="native"`.
- Mixing `mode` with either new option is rejected by TypeScript and at runtime.
- The interim cooperative-precise behavior in commit `57f73fd` requires explicit
  `resize="settled"`; the default restores the earlier immediate behavior.

Exact segment widths are reused across container widths, with at most 65,536 offset-keyed
entries per plan/metric identity. Typography changes and unmount invalidate the cache.
The 4 ms work budget is cooperative, not a hard deadline: individual browser operations
and custom synchronous predictors/calculators/selectors cannot be interrupted. Calculators
can provide a synchronous `steps` iterator. Completion can take longer than 100 ms.
Stable model/strategy references avoid redundant calculation, but memoization is not required
for correctness. Callbacks must remain deterministic for the same inputs.

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
  initial: "native",
  resize: "settled",
});
```

The hook returns a measurement ref, the selected layout, and optional diagnostics. It does
not change the target element's children or CSS. The same initial/resize options control
its scheduling, not visibility. Selection and diagnostics are null during pending initial
or geometry/text work; render source text then. Reference-only revalidation retains the
previous result. Hiding the initial content, if desired, is caller-owned.

## License

Apache-2.0.
