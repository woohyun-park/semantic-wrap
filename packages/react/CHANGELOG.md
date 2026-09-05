# @semantic-wrap/react

## 0.4.0

### Minor Changes

- c69575f: Keep precise initial rendering synchronous, but show native source wrapping during resize
  and commit only the latest settled exact result. Share resumable calculation with synchronous
  Core APIs through `selectSteps` and optional calculator `steps`, and reuse bounded exact
  segment widths across resizes with an explicit measurement metric identity.
  
  This changes precise resize timing: hook selection can be null while native text is visible,
  and final semantic wrapping may arrive after resizing stops. Progressive behavior is unchanged.
- 4d37cc5: Separate first display (`initial="resolved" | "native"`) from resize scheduling
  (`resize="immediate" | "settled"`) on SemanticWrap and useSemanticWrap. Defaults restore
  synchronous resolved-first/immediate updates. Native-first automatically calculates
  after an opportunity to paint, without waiting for a resize. Settled updates preserve
  exact selection while cooperatively calculating and cancelling obsolete work.
  
  Deprecate mode while retaining precise as resolved/immediate and progressive's legacy
  first-resize activation. Reject mixing mode with the new options. Consumers of the
  interim cooperative-precise behavior must explicitly choose resize="settled".
  
  Keep inline model predictors and strategies safe without requiring memoization. Retain
  the displayed result during same-text, same-metrics reference revalidation, publish only
  changed results (including metadata and diagnostics), and cancel obsolete work. Preserve
  resize-observer suppression across effect restarts to avoid self-notification loops.

### Patch Changes

- c69575f: Support optional synchronous `measureTexts` in Core and batch exact DOM width
  measurements in React. Preserve the full global search and selected layouts while
  reducing repeated layout flushes with a bounded, reusable measurement-probe pool.
- c69575f: Add an opt-in `nearbyLayouts()` calculator that measures candidate lines near native break positions and uses DP with Pareto pruning within those neighborhoods. Forward validated native breaks to calculators and allow them in plan calculations. The default remains `optimalLayouts()` because local search can miss globally better layouts.
  
  Handle empty native text in the React DOM measurer without throwing.
- a248925: Reduce long-text layout memory and resize work by storing only measured segment widths, reusing hidden DOM measurement probes, and locating native line transitions without scanning every character.
- Updated dependencies [c69575f]
- Updated dependencies [c69575f]
- Updated dependencies [81d9714]
- Updated dependencies [c69575f]
- Updated dependencies [a248925]
- Updated dependencies [0b6f014]
  - @semantic-wrap/core@0.4.0

## 0.3.1

### Patch Changes

- a005253: Reuse bounded text-width measurements across responsive layout selections while invalidating the cache when the measured element, source text, typography, or loaded fonts change.
- @semantic-wrap/core@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [e07fff7]
  - @semantic-wrap/core@0.3.0

## 0.2.0

### Minor Changes

- b71dc6e: Replace `resolveLineBreaks` with the lazy `createLineBreakPlan` pipeline and the one-shot
  `selectLineBreaks` API. Add precise and progressive React rendering modes with atomic resize
  updates.

### Patch Changes

- Updated dependencies [b71dc6e]
  - @semantic-wrap/core@0.2.0
