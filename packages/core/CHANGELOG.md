# @semantic-wrap/core

## 0.4.0

### Minor Changes

- c69575f: Support optional synchronous `measureTexts` in Core and batch exact DOM width
  measurements in React. Preserve the full global search and selected layouts while
  reducing repeated layout flushes with a bounded, reusable measurement-probe pool.
- c69575f: Keep precise initial rendering synchronous, but show native source wrapping during resize
  and commit only the latest settled exact result. Share resumable calculation with synchronous
  Core APIs through `selectSteps` and optional calculator `steps`, and reuse bounded exact
  segment widths across resizes with an explicit measurement metric identity.
  
  This changes precise resize timing: hook selection can be null while native text is visible,
  and final semantic wrapping may arrive after resizing stops. Progressive behavior is unchanged.
- c69575f: Add an opt-in `nearbyLayouts()` calculator that measures candidate lines near native break positions and uses DP with Pareto pruning within those neighborhoods. Forward validated native breaks to calculators and allow them in plan calculations. The default remains `optimalLayouts()` because local search can miss globally better layouts.
  
  Handle empty native text in the React DOM measurer without throwing.

### Patch Changes

- 81d9714: Reduce optimal layout calculation work by stopping segment measurement after overflow, pruning impossible suffixes, and merging Pareto frontiers incrementally.
- a248925: Reduce long-text layout memory and resize work by storing only measured segment widths, reusing hidden DOM measurement probes, and locating native line transitions without scanning every character.
- 0b6f014: Select greedy break candidates in one scan without sorting or searching the candidate list again. Consolidate immutable array helpers while preserving layout results and frozen snapshots.

## 0.3.1

## 0.3.0

### Minor Changes

- e07fff7: Standardize phrase-model levels on synchronous pluggable boundary predictors, with a BudouX adapter and a validated phrase-model definition helper.

## 0.2.0

### Minor Changes

- b71dc6e: Replace `resolveLineBreaks` with the lazy `createLineBreakPlan` pipeline and the one-shot
  `selectLineBreaks` API. Add precise and progressive React rendering modes with atomic resize
  updates.
