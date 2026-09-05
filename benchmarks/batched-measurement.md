# Exact batched DOM measurement

## Outcome

React now supplies synchronous batched measurement to the default global calculator.
The matched Chromium comparison preserved complete calculated layouts, native layouts,
selection decisions, and selected widths in all 204 comparisons: 17 inputs × 4 width
steps × 3 repetitions. This covers 51 distinct input/width conditions, including all
13 conditions whose model costs regressed with `nearbyLayouts({ radius: 2 })`.

Long-input median time reductions were approximately 5–18%. This preserves layout
quality, but is not a dramatic improvement or a solution to long main-thread stalls.
No React configuration is required. The nearby calculator remains a separate opt-in
experiment; these results use the full global candidate space throughout.

## Implementation

Core accepts optional `measureTexts(texts)` alongside the required `measureText` in
measurement inputs and calculation contexts. It must synchronously return an array
of finite, non-negative widths in input order, equivalent to `texts.map(measureText)`.
The scalar-only path remains available and supplies the matched baseline.

The global calculator advances up to 64 independent segment starts together. Each
start stops at precisely the first overflow used by the scalar implementation.
It buffers only the current block's rows before flattening them into the existing
segment table. Candidate boundaries, minimum-line calculation, DP, Pareto pruning,
and tie-breaking rules are unchanged. Materializing layouts can also batch line widths.

React prepares all missing strings in a chunk before reading their geometry. It reuses
a pool of at most 64 hidden spans per measurement cache, allocated lazily. Normalization,
typography, and the 128-entry text-width cache limit are unchanged. Duplicate normalized
strings within a chunk share one measurement. Invalidation and unmount release the pool.
The change remains synchronous and Core does not import browser APIs.

## Measurement method

- Local macOS arm64, Chromium, Bun 1.4.0. Three repetitions per input and algorithm.
- Alternate algorithm order by repetition. Each algorithm/repetition starts with fresh
  text and native caches, retained across the width sequence.
- Documentation titles: 28 px font, widths 240 → 320 → 420 → 320 px.
- Other cases: 16 px font, widths 360 → 660 → 900 → 660 px.
- Times include synchronous prediction, native measurement, text measurement, global
  calculation, and selection. They exclude React commit and browser paint. Diagnostic
  layout serialization happens after the timer stops.
- Baseline and batch implementations are measured in the same harness, with the same
  default global calculator and styles. Do not compare these numbers directly to the
  earlier 789.2 ms observation or a different benchmark run.
- With three samples, nearest-rank P95 equals the observed maximum. Neither establishes
  a reliable production tail estimate. Character counts are UTF-16 code units.

## Results

Times are medians in milliseconds. A new width is a first visit within the sequence,
while return visits reuse the same bounded caches.

| Input | Width / state | Scalar | Batched | Time reduction |
| --- | --- | ---: | ---: | ---: |
| Medium Korean, 255 | 360 / cold | 13.7 | 12.8 | 7% |
| Medium Korean, 255 | 900 / new | 33.4 | 29.0 | 13% |
| Repeated text, 5,627 | 360 / cold | 341.0 | 320.8 | 6% |
| Repeated text, 5,627 | 660 / new | 547.9 | 497.9 | 9% |
| Repeated text, 5,627 | 900 / new | 784.5 | 725.3 | 8% |
| Repeated text, 5,627 | 660 / return | 540.7 | 505.7 | 6% |
| Distinct sentences, 10,601 | 360 / cold | 685.1 | 648.0 | 5% |
| Distinct sentences, 10,601 | 660 / new | 982.5 | 865.3 | 12% |
| Distinct sentences, 10,601 | 900 / new | 998.8 | 816.2 | 18% |
| Distinct sentences, 10,601 | 660 / return | 996.2 | 875.8 | 12% |
| Doubled repeated text, 11,255 | 360 / cold | 843.1 | 778.2 | 8% |
| Doubled repeated text, 11,255 | 660 / new | 1,297.2 | 1,226.2 | 5% |
| Doubled repeated text, 11,255 | 900 / new | 1,793.9 | 1,657.8 | 8% |
| Doubled repeated text, 11,255 | 660 / return | 1,289.2 | 1,211.2 | 6% |

At 5,627 characters / 900 px, observed maxima were 784.9 ms scalar and 734.4 ms batched.
At 10,601 characters / 900 px, they were 1,013.7 ms and 822.2 ms.

Short-title median differences ranged from roughly -0.2 to +0.3 ms. The Korean
purpose title at 240 px was 1.5 → 1.7 ms; its model cost stayed 0.35 and its lines
remained `더 나은 제품을 / 만들기 위해 / 팀이 버려야 할 습관`. Its 320 px visit was
0.3 → 0.6 ms. These small samples do not establish a short-title speed improvement.

## Work and memory tradeoffs

The 5,627-character / 900 px run retained exactly the same global search counters:

| Counter | Scalar | Batched |
| --- | ---: | ---: |
| Measured calculator segments | 27,083 | 27,083 |
| Allocated segment-width slots | 27,083 | 27,083 |
| Visited DP states | 717 | 717 |
| Generated layouts | 59,709 | 59,709 |
| Pareto comparisons | 105,382 | 105,382 |
| Maximum Pareto frontier | 59 | 59 |
| DOM text reads | 27,320 | 27,257 |
| Retained measurement spans | 1 | 64 |

Batching changes measurement order and groups duplicates, so the same 128-entry LRU
cache can have a different hit rate. Distinct sentences at 900 px had 30,990 → 26,734
DOM reads, while the cold 360 px case increased from 23,328 to 23,932 reads. Speedups
therefore should not be attributed entirely to fewer layout flushes. Flush counts were
not separately recorded; exact width work is still substantial.

The pool trades more hidden DOM nodes for lower repeated measurement overhead, and the
calculator adds a bounded block of temporary row buffers. The 64 limit bounds node count,
not total heap bytes or retained text length. Heap usage was not measured. Many mounted
components may make the extra nodes relevant; measured title pools were smaller (for
example nine spans for the Korean purpose title).

## Validation and reproduction

- Full benchmark: 204/204 complete-layout comparisons identical in Chromium, including
  every previously identified radius-2 quality regression.
- Standard browser regression: 14 inputs × 4 width steps = 56 full-layout pairs per
  browser, across Chromium, Firefox, and WebKit.
- Direct width checks: whitespace modes `normal`, `pre`, `pre-wrap`, `pre-line`, and
  `break-spaces`, two font sizes, letter/word spacing, kerning, Arabic, Korean, emoji,
  combining marks, duplicate strings, and inputs larger than the pool and cache limits.
  Checks verify width equality, pool reuse, invalidation cleanup, and the 64-node limit.
- Core checks: complete frontier and measured-segment multiset parity across the 64-start
  block boundary; non-monotonic synthetic widths; public selection/diagnostic parity;
  malformed batch results. The existing global exhaustive-oracle tests also pass.
- `bun run check`: 64 unit tests passed; 141 browser tests passed, 12 opt-in tests skipped;
  types, build, generated-document checks, package checks, and publint passed.
- React Doctor: 92/100, no issues found.

```sh
bun run bench:batch
bun run check
```

`bench:batch` builds the fixture and writes `batch-comparison.json` into the Playwright
test output. Keep raw browser reports and local diagnostics out of commits.
