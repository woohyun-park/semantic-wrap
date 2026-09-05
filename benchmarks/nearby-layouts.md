# Native-neighborhood layout search: comparison

## Decision

Keep `optimalLayouts()` as the default. Offer `nearbyLayouts({ radius: 2 })` as
an explicit speed/quality tradeoff. The local search substantially reduces work on
some long inputs, but does not preserve the global search's layout quality and is
not consistently fast enough for smooth resizing.

```tsx
import { createLineBreakStrategy, nearbyLayouts } from "@semantic-wrap/core";

const strategy = createLineBreakStrategy({ calculate: nearbyLayouts() });

<SemanticWrap model={model} strategy={strategy}>
  <p>{text}</p>
</SemanticWrap>;
```

## What changed

The existing calculator searches the full candidate space. The new calculator
searches a layered graph around native line endings, keeping the native line
count. Radius 2 admits up to five model candidates per native ending (the anchor,
if allowed, and two candidates on either side). It uses iterative suffix DP,
Pareto pruning, and exact substring measurements, not additive width estimates.

Without a supplied native layout, it uses the existing global calculator. If no
local path fits, the default selector preserves native wrapping. React supplies
native breaks automatically. The APIs remain synchronous, rendering remains
wrapper-free, and cache limits are unchanged. Neither the Pareto frontier nor
total running time has a constant worst-case bound.

## Method

- Baseline: global calculator after commit `9c01688`, not an older implementation.
- Environment: local Chromium, macOS arm64, Bun 1.4.0.
- Algorithm comparison: three runs per case, algorithm, and width step; execution
  order alternates. Text/native measurement caches are fresh for each algorithm
  and repetition, then retained across that run's width sequence.
- Long-text sequence: 360 → 660 → 900 → 660 px, at 16 px font size. Documentation
  titles use 240 → 320 → 420 → 320 px, at 28 px font size.
- Algorithm total includes synchronous prediction, native measurement, text
  measurement, calculation, and selection. It excludes React commit and paint.
- Quality comparison: 17 cases × 3 distinct widths = 51 pairs; repeat visits and
  repetitions are not counted as additional quality cases.
- Median is the middle value (or mean of the two middle values). P95 uses the
  nearest-rank definition; with only three repetitions it equals the observed
  maximum, not a reliable production tail estimate.
- These are local observations, not performance guarantees. The previous
  789.2 ms observation was not reused as a matched baseline.

## Algorithm timing and measurement work

All times below are medians in milliseconds. "New" means a previously unvisited
width in the sequence, not a cold instance. Character counts use JavaScript
string length (UTF-16 code units).

| Input | Width / state | Global | Nearby radius 2 | Reduction | DOM text reads, global → nearby |
| --- | --- | ---: | ---: | ---: | ---: |
| Medium Korean, 255 | 360 / cold | 15.7 | 6.5 | 59% | 531 → 192 |
| Repeated long text, 5,627 | 360 / cold | 361.5 | 149.8 | 59% | 11,523 → 4,019 |
| Repeated long text, 5,627 | 660 / new | 570.6 | 79.7 | 86% | 20,234 → 2,039 |
| Repeated long text, 5,627 | 900 / new | 817.2 | 64.1 | 92% | 27,320 → 1,496 |
| Repeated long text, 5,627 | 660 / return | 571.6 | 78.4 | 86% | 20,239 → 2,038 |
| Distinct sentences, 10,601 | 360 / cold | 725.4 | 696.4 | 4% | 23,328 → 21,208 |
| Distinct sentences, 10,601 | 660 / new | 1,039.3 | 657.8 | 37% | 30,589 → 15,555 |
| Distinct sentences, 10,601 | 900 / new | 1,033.4 | 223.0 | 78% | 30,990 → 4,864 |
| Doubled repeated text, 11,255 | 360 / cold | 880.9 | 425.3 | 52% | 22,887 → 7,949 |
| Doubled repeated text, 11,255 | 900 / new | 1,843.8 | 144.7 | 92% | 54,566 → 2,935 |

Distinct sentences contain repeated vocabulary but no identical full sentences.
The narrow-width result is an important limitation: fewer nearby candidates do
not guarantee a dramatic reduction in measurement or Pareto work.

For the 5,627-character input at 900 px:

| Calculator | Median | P95 / observed max | DOM text reads |
| --- | ---: | ---: | ---: |
| Global | 817.2 | 824.0 | 27,320 |
| Radius 1 | 30.9 | 31.8 | 607 |
| Radius 2 | 64.1 | 66.9 | 1,496 |
| Radius 4 | 184.9 | 187.0 | 4,308 |

Radius 2 reduced DOM text reads by 94.5% in this condition. This reduction does
not hold for every condition; for example the repeated-text cold run reduced
reads by 65%, and the distinct-sentence cold run by only 9%.

## React hook resize measurement

A separate test visits ten widths from 360 to 900 px. These percentiles describe
ten different width updates in one sequence, not repeated trials of one width.
Commit timing ends at a layout effect after the hook's state update; it does not
measure paint or full long-text `<br>` rendering.

| Metric | Global | Nearby radius 2 |
| --- | ---: | ---: |
| Selection median | 575.1 ms | 83.7 ms |
| Selection P95 / max | 825.7 ms | 167.6 ms |
| State commit median | 575.3 ms | 83.9 ms |
| State commit P95 / max | 825.8 ms | 168.0 ms |
| DOM text reads across ten updates | 194,228 | 23,025 |
| Text probe time across ten updates | 4,939.5 ms | 704.9 ms |
| Native Range reads across ten updates | 7,318 | 7,318 |
| Observed tasks over 50 ms | 10 | 10 |

Updates became shorter, but long tasks were not eliminated. This is not a 60fps
solution. A separate lifecycle test exercises actual `SemanticWrap` rendering.

## Quality regressions

Costs below are the model and balance costs, where lower is better. Counts may
overlap: a case can worsen in both metrics. "Missed improvement" means global
search applied an improvement while local search retained native wrapping.

| Radius | Same selected breaks / 51 | Missed improvement | Worse model cost | Worse balance cost | Same documentation title breaks / 18 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 33 | 3 | 18 | 17 | 12 |
| 2 | 38 | 0 | 13 | 11 | 16 |
| 4 | 43 | 0 | 8 | 8 | 18 |

Zero observed misses for radius 2 is not a guarantee. A unit counterexample
explicitly verifies a semantic improvement outside its neighborhood is missed.
The largest short-title median slowdown observed was about 0.2 ms, but even
short titles can lose semantic quality. At 240 px and 28 px font size:

| Title | Global lines | Radius 2 lines | Model cost |
| --- | --- | --- | --- |
| English audience | Design / documentation / for people / who need to act | Design / documentation / for people who / need to act | 1.35 → 2.35 |
| Korean purpose | 더 나은 제품을 / 만들기 위해 / 팀이 버려야 할 습관 | 더 나은 제품을 / 만들기 위해 팀이 / 버려야 할 습관 | 0.35 → 1.05 |

Both examples improve balance but worsen meaning according to the model. On the
5,627-character, 900 px case, all variants retain 70 lines, while model cost rises
from 33.75 globally to 47.45 / 45.5 / 43.75 for radii 1 / 2 / 4. Increasing the
radius trades back some speed for quality but does not restore global equivalence.
A browser screenshot of the first four lines of the worst radius-2 model-cost
regression was also inspected; it is a diagnostic excerpt, not a full visual audit.

## Work and storage counters

For 5,627 characters at 900 px:

| Counter | Global | Nearby radius 2 |
| --- | ---: | ---: |
| Calculator measured segments | 27,083 | 1,394 |
| Generated candidate layouts | 59,709 | 3,745 |
| Maximum observed Pareto frontier | 59 | 15 |
| Retained text-width cache entries | 128 | 128 |
| Text-width cache key UTF-16 units | 15,596 | 15,623 |

The new calculator does not retain the global calculator's segment-width table
(27,083 allocated width slots in this baseline case). These are work/storage
counters, not heap-byte measurements. Candidate paths still allocate arrays and
strings, and this run does not establish a general bound on memory usage.

## Regression coverage and reproduction

- Independent exhaustive oracle: 80 seeded contexts × 3 radii, comparing local
  DP results against exhaustive search of the same restricted space.
- Unit cases: overlapping neighborhoods, native anchors absent from candidates,
  non-monotonic measured widths, absent/invalid native layouts, no feasible path,
  overflow, empty text, whitespace, emoji, combining marks, and a missed global
  improvement. Native input is validated and snapshotted before custom calculation.
- Chromium, Firefox, and WebKit safety tests: valid semantic boundaries, source
  preservation, no new overflow when native fits, no increased line count,
  genuine semantic improvement before applying, and native retention otherwise.
- React integration: precise/progressive SSR, text/width/font-size updates, font
  loading events, unmount/remount cleanup, hook/rendered result consistency, and
  wrapper-free rendering. Empty-text native measurement was fixed during testing.
- `bun run check`: passed (61 unit tests; 135 browser tests passed, 9 skipped,
  plus build, types, generated-document checks, package checks, and publint).
- React Doctor: 92/100, no issues reported.

```sh
bun run bench:nearby
bun run bench:react
bun run check
```

The algorithm benchmark writes `nearby-comparison.json` and a quality-comparison
screenshot into its Playwright test output. Keep generated browser reports and
local diagnostics out of commits. Both benchmark scripts build the browser
fixture first. Consult `tests/browser/performance.spec.ts` for the React
benchmark's gate and recorded raw samples.
