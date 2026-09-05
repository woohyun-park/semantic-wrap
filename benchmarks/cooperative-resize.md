# Precise resize: exact results without one uninterrupted calculation

## Behavior and scope

The existing `precise` mode keeps synchronous initial selection. Once initially resolved,
it shows the original text with native wrapping during resize, runs exact selection in
cooperative slices, and commits only the latest completed result after approximately
100 ms of stable width. There is no new mode. `progressive` retains its existing behavior.

This deliberately changes precise resize presentation: callers of `useSemanticWrap` can
receive a null selection while the source remains visible. Semantic wrapping can arrive
after the gesture ends. First-load latency is not addressed by this change.

Core and React remain separate. The existing synchronous methods consume the same
generator used by `plan.selectSteps`. A custom calculator can supply `calculate.steps`;
without it, that callback is synchronous and indivisible. Prediction, custom selection,
and individual browser operations are also not preemptible. Approximately 4 ms is a
cooperative work target, not a hard upper bound on every task.

Exact segment widths are retained by source-offset pair under a measurement metric key.
The cache is FIFO-bounded at 65,536 entries per plan/key, in addition to the existing
128-entry normalized string cache and at most 64 DOM measurement spans. Eviction causes
remeasurement only. React changes the key when text metrics are invalidated. Pending work
is cancelled on a newer resize, style/font changes, effect cleanup, or unmount. Final
commit rechecks the current width and metric style signature.

## Baseline and measurement

The baseline is a frozen browser bundle captured immediately before this change. It
already includes exact batched DOM measurement, the previous global calculator, and the
same comparison fixture. It does not contain `selectSteps` or cooperative resize.
Neither the old 789.2 ms observation nor a different benchmark's totals is used as the
matched baseline here.

- Local macOS arm64, Bun 1.4.0, headless Chromium, 1000 × 720 viewport.
- Five inputs, three repetitions each, both versions: 30 recorded scenarios, 15 pairs.
- Each version runs in its own fresh browser context, sequentially. Order alternates
  by repetition. Initial synchronous rendering and font readiness complete before the
  resize measurement starts; the initial width is therefore already warm.
- A 2.4-second wall-clock trajectory widens, reverses, and settles. Long inputs use
  360 → 900 → 360 → 660 px; they end at the initially measured width. This explicitly
  exercises reuse. A blocked baseline misses intermediate animation callbacks, so the
  actual number of visited widths differs; the intended input trajectory is the same.
- The short title uses 28 px type and 240–420 px widths. Its last trajectory segment is
  already constant at 240 px, so it may finish before the scripted stop marker. Its
  zero post-stop mutation delay must not be read as zero settling latency.
- Performance runs have no recording. A separate pass records videos. A 25 ms timer
  delay is an event-loop responsiveness proxy, not measured INP or real pointer latency.
- Frame gaps come from requestAnimationFrame timestamps. Long tasks come from the
  browser's Long Tasks observer. No observed long task means no observed task over
  50 ms, not zero work. The headless frame cadence is not a 60fps device guarantee.

## Results

Each P95 entry below is the median of three per-run frame-gap P95 values. Final commit
delay is the median time from the scripted resize end to the last visible text mutation.
Smaller values are better. Times are milliseconds.

| Input | Frame-gap P95, before → after | Final commit delay, before → after | Long tasks across 3 runs, before → after |
| --- | ---: | ---: | ---: |
| Short Korean title | 9.9 → 10.0 | Not applicable: finishes before scripted stop | 0 → 0 |
| Medium Korean, 255 units | 25.4 → 9.9 | No final baseline mutation → 103.0 | 0 → 0 |
| Repeated long text, 5,627 units | 516.9 → 24.1 | 515.5 → 102.8 | 21 → 0 |
| Distinct sentences, 10,601 units | 1,075.0 → 16.8 | 896.1 → 1,049.5 | 12 → 0 |
| Doubled repeated text, 11,255 units | 1,266.6 → 18.0 | 1,259.9 → 719.1 | 12 → 0 |

Length is JavaScript UTF-16 code units. The distinct-sentence case still takes about a
second after the gesture to finish, and that delay increased in this run. Cooperative
scheduling improves responsiveness, not necessarily completion latency. The doubled
input still takes roughly 0.7 seconds after the gesture.

Maximum observed frame gaps across all three runs were 716.3 → 26.4 ms for the 5,627-unit
case, 4,233.2 → 33.5 ms for distinct sentences, and 1,683.0 → 43.2 ms for doubled text.
The 4.2-second baseline sample is an observed outlier; these few local repetitions are
not a production tail estimate.

Median DOM text reads across the complete gesture and settlement fell from 124,444 to
1,941 for 5,627 units, 118,867 to 12,645 for distinct sentences, and 130,742 to 454 for
doubled text. These reductions combine reuse, cancelling obsolete work, and differences
in the number of visited widths; they are not per-width speedup ratios.

All 15 after-scenarios in the final run had zero observed long tasks. An earlier
exploratory run did include after-side outliers up to 226 ms. They are not discarded as
proof that stalls are impossible. A separate profiled doubled-text run had no long tasks
but included paint events around 33 ms. Rendering, GC, browser conditions, and indivisible
operations can still cause frame delays; the source of the earlier outlier was not proven.

## Quality and regression evidence

- Frozen baseline versus new implementation: 68/68 complete diagnostic comparisons
  identical, covering 51 distinct input/width conditions plus return-width visits. This
  includes all 13 conditions previously worsened by radius-2 neighborhood search.
- 15/15 live resize pairs ended with byte-identical visible `innerHTML`.
- Browser tests verify visible source text while resizing, final exact wrapping, text
  and font changes during pending work, cancelled jobs, unmount cleanup, remount, and
  wrapper-free rendering. Chromium, Firefox, and WebKit pass.
- Core tests verify synchronous/resumable diagnostic parity, reuse across widths,
  interleaved jobs with distinct metric keys, cancellation cleanup, and FIFO eviction
  after capacity. Existing exhaustive global-search oracle tests pass.
- Final `bun run check` passed: 68 unit tests and 144 browser tests, with 24 opt-in tests
  skipped. The frozen-baseline quality check and separate video pass also passed in
  their dedicated runs.
- React Doctor: 92/100, no issues found.

Memory is bounded by entry/node counts, not measured heap bytes. Offset keys avoid
retaining each full substring, but the new cache has real per-component memory cost.
Heap consumption under many simultaneously mounted long-text components was not measured.

## Video artifacts

The local artifact directory is `dogfood-output/resize-comparison-AIivjB/` (untracked).
Open `comparison.html` for both side-by-side players, original recordings, and raw metrics.

- `long-comparison.mp4`: 5,627-unit input, before on the left and after on the right.
- `short-comparison.mp4`: the Korean purpose title at 28 px, including 240 px wrapping.
- `long-before.webm`, `long-after.webm`, `short-before.webm`, `short-after.webm` retain
  the original recordings, including initial display.
- `metrics.json` contains the final non-recorded performance samples.

Versions were recorded separately. Composite clips retain original speed and align the
input start approximately, accounting for the baseline's delayed first visible update.
The shorter recording is held on its last frame. The clips are qualitative evidence,
not a substitute for timing data. They were inspected at resize and completion frames,
and the players were checked in a browser.

## Reproduction

Before changing the implementation, freeze the browser fixture bundle:

```sh
# Choose an output directory outside tracked source before capturing the baseline.
bun -e 'await Bun.build({entrypoints:["tests/browser/client.tsx"],target:"browser",format:"esm",outdir:"/tmp/semantic-wrap-resize-baseline"})'
```

Then run the changed implementation with that frozen baseline:

```sh
SEMANTIC_WRAP_RESIZE_BASELINE=/tmp/semantic-wrap-resize-baseline/client.js bun run bench:resize
SEMANTIC_WRAP_RESIZE_BASELINE=/tmp/semantic-wrap-resize-baseline/client.js bun run record:resize
SEMANTIC_WRAP_RESIZE_BASELINE=/tmp/semantic-wrap-resize-baseline/client.js SEMANTIC_WRAP_RESIZE_QUALITY=1 bunx playwright test tests/browser/resize-performance.spec.ts --project=chromium --workers=1
bun run check
```

The commands write raw reports/videos into Playwright output. Copy artifacts elsewhere
before another Playwright run replaces that output. Do not commit browser reports,
recordings, or other local diagnostics.
