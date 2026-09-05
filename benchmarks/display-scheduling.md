# Independent first display and resize scheduling

## Contract

`@semantic-wrap/react` exposes two independent options on both `SemanticWrap` and
`useSemanticWrap`. They do not change prediction, the full global candidate space,
exact DOM measurement, native comparison, or the final selection policy.

| | `resize="immediate"` | `resize="settled"` |
| --- | --- | --- |
| `initial="resolved"` | Default: exact-first, synchronous updates | Exact-first, cooperative stable-width updates |
| `initial="native"` | Native-first automatic calculation, synchronous updates | Native-first automatic calculation, cooperative stable-width updates |

Resolved-first initially hides the source using opacity, without removing its text or
adding a wrapper. Native-first gives the browser an opportunity to paint source text
before starting cooperative work. It starts automatically, even without any resize,
and does not add a 100 ms wait to the initial result. A resize during initial work
cancels that job and uses the selected update policy.

Settled updates keep source text visible, cancel obsolete jobs, and apply only the
latest result after approximately 100 ms of stable width and completed computation.
Immediate updates calculate synchronously without a stability timer. The approximate
4 ms slice target is not preemption: individual DOM operations and custom synchronous
callbacks remain indivisible. Native-first does not imply asynchronous return values
from Core's public synchronous APIs.

Legacy `mode="precise"` restores resolved/immediate behavior. Legacy
`mode="progressive"` retains first-resize activation, unlike new native-first automatic
calculation. Both are deprecated; mixing mode with either new option is rejected at
type-checking time and at runtime. Consumers of the intermediate `57f73fd` cooperative
precise implementation must opt into `resize="settled"`.

The headless hook owns scheduling only: source rendering and visibility belong to
the caller. Selection and diagnostics can be null during cooperative work. Text changes
start a new first-display lifecycle. Model/strategy reference changes at unchanged text
and metrics retain the visible result while revalidating. Only changed results publish
React state, including widths, reason, candidate metadata and diagnostics. Font/style
changes invalidate measurements and use the update policy. New options, new inputs,
and unmount dispose old iterators and timers. Stable input references reduce redundant
work but are not required for correctness.

## Measurement protocol

- Compare a frozen pre-cooperative synchronous bundle, a frozen `57f73fd` bundle, and
  all four new combinations. The oldest bundle already includes exact batched measurement.
- Five inputs: short Korean title, 255-unit medium input, 5,627-unit repeated input,
  10,601-unit distinct sentences, and 11,255-unit doubled repeated input. Lengths are
  JavaScript UTF-16 code units.
- Fresh browser context per scenario, local headless Chromium, 1000 × 720 viewport.
  Three repetitions, alternating forward/reverse variant order. Timing and video runs
  are separate. These are local observations, not low-end-device or production guarantees.
- Cold startup records the first measured hidden span, first visible content frame,
  first exact DOM mutation, and first exact frame. The measured-selection span is wall
  time from the first span measurement to the exact mutation, including scheduling and
  React commit; it is **not pure calculator CPU time**. Navigation-relative first-frame
  times also include loading/hydration and should not be read as library-only latency.
- To make the short cold result observable in every frozen fixture, temporary equal CSS
  sets 240 px container width and 28 px text. This is removed before resize; font size
  remains 28 px. Other inputs use the fixture's 660 px / 16 px startup.
- After startup and font readiness, apply the same intended 2.4-second wall-clock width
  trajectory as `cooperative-resize.md`. Blocked versions visit fewer intermediate widths.
  Compare final HTML, frame-gap P95, observed tasks over 50 ms, and post-gesture mutation
  delay. The short trajectory has a constant tail, so its zero final delay is not evidence
  of zero settling latency.
- A separate short-title single-change experiment alternates widths, discards two warmup
  visits, and records 30 final mutation latencies per variant. It avoids the constant-tail
  ambiguity and compares the same final HTML at each width.
- Frozen full-diagnostic comparison covers 68 visits / 51 distinct conditions, including
  the 13 conditions previously worsened by optional neighborhood search.

## Final results

The final-source run completed 90 scenarios (5 inputs × 3 repetitions × 6 variants).
All six variants ended with byte-identical HTML in each of the 15 input/repetition
groups. The separate frozen diagnostic check passed all 68 visits / 51 distinct
conditions. A development run also passed, but its timings are not mixed into these
final values.

### Short-title latency

Times are milliseconds, from one width change to its final visible mutation. Each
variant has 30 measured samples after two warmup visits. Median averages the middle
two values; P95 uses nearest rank. Widths alternate between 240 and 420 px.

| Variant | Median | P95 |
| --- | ---: | ---: |
| Frozen pre-cooperative synchronous | 4.0 | 7.8 |
| Frozen `57f73fd` | 108.5 | 111.0 |
| `resolved` / `immediate` (new default) | 5.0 | 8.0 |
| `resolved` / `settled` | 109.7 | 113.5 |
| `native` / `immediate` | 4.5 | 6.9 |
| `native` / `settled` | 108.7 | 114.1 |

The new default removes the unconditional stability delay. It is not zero-overhead:
the observed median is about 1.1 ms higher than the oldest synchronous baseline.
Cold short-title measured-selection span was 4.6 ms in that baseline, 4.8 ms at
`57f73fd`, and 5.2 ms in the new default. These are small local samples, not proof of
equal pure calculation CPU cost or a production tail guarantee.

### Resize responsiveness

Each cell is the median of three per-run frame-gap P95 values, in milliseconds.
Smaller is better. Native-first does not make immediate resize non-blocking.

| Input | Old synchronous | `57f73fd` | New resolved/immediate | New native/settled |
| --- | ---: | ---: | ---: | ---: |
| Short title | 9.1 | 9.1 | 9.1 | 9.2 |
| Medium, 255 units | 26.9 | 9.2 | 9.1 | 9.1 |
| Repeated, 5,627 units | 516.7 | 24.1 | 133.4 | 25.0 |
| Distinct, 10,601 units | 940.7 | 16.7 | 541.1 | 16.7 |
| Doubled, 11,255 units | 1,282.8 | 23.9 | 833.3 | 17.3 |

Both new settled combinations had zero observed tasks over 50 ms across their 30
scenarios. This is not a guarantee that stalls are impossible; earlier development
measurements in this repository observed outliers, and individual browser/custom
operations remain indivisible. The long immediate combinations still had long tasks.
Some immediate variants had more tasks than the old baseline because they processed
more intermediate widths in the same wall-clock trajectory. Raw counts are not a
per-width comparison.

Final application is a separate tradeoff. Median delay after the scripted resize end:

| Input | Old synchronous | `57f73fd` | New resolved/immediate | New native/settled |
| --- | ---: | ---: | ---: | ---: |
| Repeated, 5,627 units | 506.6 | 102.7 | 44.2 | 102.9 |
| Distinct, 10,601 units | 912.2 | 1,010.2 | 530.8 | 1,058.1 |
| Doubled, 11,255 units | 1,249.2 | 721.8 | 362.7 | 731.2 |

Settled retains responsiveness similar to `57f73fd`, but distinct sentences still
finish about a second after the gesture. Completion is not necessarily faster than
synchronous execution. Do not interpret the short/medium trajectory's absent final
baseline mutation as zero calculation or zero settling delay.

### First source versus first exact result

The following navigation-relative first-frame medians compare two variants of the
same new fixture. They include page loading/hydration and browser scheduling, not
just library CPU time. Raw initial-measurement spans are also retained in metrics.

| Input | Resolved/immediate: first visible and exact frame | Native/settled: first source frame | Native/settled: first exact frame |
| --- | ---: | ---: | ---: |
| Short title | 63.3 | 54.0 | 68.0 |
| Repeated, 5,627 units | 623.3 | 56.5 | 1,182.4 |
| Distinct, 10,601 units | 1,060.1 | 59.1 | 2,039.2 |
| Doubled, 11,255 units | 1,512.8 | 59.4 | 2,807.7 |

Native-first exposes useful text earlier, but spreads the exact calculation over
more elapsed time. For a short title, the visibility benefit is small; resolved-first
remains the default. No claim of zero initial blocking is made for custom callbacks
or individual DOM operations. Redundant callbacks for already-ready fonts are no
longer scheduled; a settled font update can still legitimately follow an initial result.

## Functional verification

- `bun run check`: 71 unit tests and 180 browser tests passed; 33 opt-in diagnostic
  tests skipped. Build, types, generated documentation, package checks and publint passed.
- All four combinations are exercised with the component and hook. SSR hydration and
  Strict Mode are covered in Chromium, Firefox, and WebKit. Tests check native-first
  startup without resize, the immediate atomic update path, settled source visibility,
  cancellation of the first obsolete width, text/strategy/font/option changes, and cleanup.
- Cancellation tests hold a test iterator explicitly until the mutation occurs, rather
  than assuming a slow callback will still be pending when browser automation clicks.
- Legacy progressive activation and updated selected-candidate metadata remain covered.
  SSR and type tests reject invalid values and mixed legacy/new props.
- React Doctor for `packages/react`: 92/100, no errors, one warning about `flushSync`
  bypassing View Transitions. It is retained for the synchronous/atomic commit contract.
  A repository-wide scan also reports duplicated JSX in the bilingual docs tables.

During development, tests caught a render loop from equivalent inline model containers
and ResizeObserver self-notifications caused by height changes while applying breaks.
Pre-commit review then found that the guarded render-state adjustment failed for fresh
predictor objects and that effect-local result deduplication failed for fresh strategies.
The follow-up removes input state mirroring and plan-identity display gating. Published
results and scheduling context persist across effect lifetimes via refs updated only
after commit, while cleanup cancels obsolete jobs. Width delivery temporarily detaches observation around its own visible
commit, then reobserves on the next frame; any width change in that gap is checked again.
The pause survives effect restarts inside an observer delivery. This does not merge or
defer the immediate width calculation itself. The tables above are the pre-fix snapshot;
the follow-up measurements below separately verify the corrected implementation.

## Reference-safety follow-up

The corrected implementation was compared with a bundle frozen immediately before
the reference-safety fix, not with the older `57f73fd` scheduling policy. Both sides
use all four independent options. Short and 5,627-character inputs run three times
per option/version in alternating order (48 trajectories); short single-width latency
uses two warm-ups and 30 measured changes per option/version (240 samples).

Short single-width application latency (milliseconds):

| Option | Before median / P95 | Fixed median / P95 |
| --- | ---: | ---: |
| resolved / immediate | 4.45 / 7.7 | 5.15 / 7.9 |
| resolved / settled | 109.75 / 112.4 | 110.45 / 111.9 |
| native / immediate | 5.15 / 8.0 | 4.55 / 8.2 |
| native / settled | 108.70 / 113.9 | 109.55 / 112.4 |

Long-input medians of three runs (milliseconds):

| Option | Frame P95 before → fixed | Final application delay before → fixed |
| --- | ---: | ---: |
| resolved / immediate | 150.1 → 141.6 | 45.6 → 46.8 |
| resolved / settled | 24.9 → 17.6 | 103.7 → 105.5 |
| native / immediate | 150.0 → 166.7 | 45.0 → 45.3 |
| native / settled | 24.7 → 17.6 | 103.9 → 106.2 |

These results support preserved scheduling behavior, not an across-the-board speedup.
Native/immediate frame P95 increased by 11.1% in this sample; its per-run values were
150.0/150.1/108.5 before and 183.4/141.7/166.7 after. Three wall-clock trajectories are
insufficient to distinguish a systematic regression from run-to-run variation, and
blocked frames sample different intermediate widths. Do not treat this as a formal
performance-equivalence test. Settled remains the responsiveness option for long inputs.
One fixed native/settled run recorded a 54 ms long task; the other five fixed long-input
settled runs recorded none. A cooperative slice budget does not guarantee zero long tasks.

The default cold short-title measured-selection span was 5.1 → 5.2 ms; the corresponding
long-title span was 577.8 → 583.4 ms. These are wall-clock spans, not pure CPU timings.
All 48 trajectory outputs and all 240 short-width samples matched their counterpart HTML.
The independent frozen quality check matched all 68 visits / 51 unique conditions.
No video was re-recorded for this internal correctness fix; the older recordings below
illustrate scheduling policy, not the corrected implementation's measured performance.

Verification:

- The two original failure cases first failed against the unfixed implementation.
- 99 focused checks passed across Chromium, Firefox and WebKit, covering fresh
  predictors/strategies together and separately, changed closures, candidate metadata,
  diagnostics, same-render geometry/input changes, retained revalidation output,
  cancellation, all four policies, SSR and Strict Mode.
- `bun run check`: 71 unit tests and 243 browser tests passed, 33 opt-in tests skipped;
  build, type checks, generated docs, package checks and publint passed.
- One earlier parallel run timed out at the existing five-second initial-layout wait
  in the Firefox long-input test. Three isolated repetitions and a full rerun passed
  without weakening that assertion. This remains a timing-sensitive integration check;
  the serial benchmark is the performance comparison, not the test's elapsed time.
- React Doctor: React package 92/100, no errors, one existing `flushSync` warning.
  The repository change scan reports four duplicated-JSX warnings in bilingual docs
  (78/100), not new React engine errors. No warnings were suppressed.
- No new React API or minimum-version requirement was introduced. React's guidance
  that [memoization is an optimization, not a correctness requirement](https://react.dev/reference/react/useMemo)
  informed the separation of input identities, cancellable work and displayed results.

Reproduce this narrower comparison with a frozen pre-fix option-aware bundle:

```sh
SEMANTIC_WRAP_REFERENCE_BENCHMARK=1 \
SEMANTIC_WRAP_OPTIONS_BASELINE=/path/to/pre-reference-fix/client.js \
bunx playwright test tests/browser/scheduling-performance.spec.ts --project=chromium --workers=1
```

## Local video artifacts

`dogfood-output/scheduling-comparison-IH426e/` contains the untracked viewer
`comparison.html`, final `metrics.json`, `short-latency.json`, and six original WebM
recordings. The two composite MP4s were visually inspected during resizing and after
completion; all eight players loaded and playback was checked in a browser.

- `short-comparison.mp4`: resolved/immediate on the left, native/settled on the right.
- `long-comparison.mp4`: frozen old synchronous on the left, native/settled on the right.

Recordings were made separately at original speed. Composites approximately align the
scripted input start, retain original speed, and extend only the shorter final frame.
The short clip is 4.8 seconds; the long clip is 6 seconds. Original recordings retain
startup. Video timestamps/first captured frames are not a substitute for initial-display
metrics. These diagnostic files must not be committed.

## Reproduction

Freeze browser fixture bundles outside tracked source before changing each baseline.
Never use the changed bundle as its own baseline. Both baseline paths are required:

```sh
SEMANTIC_WRAP_RESIZE_BASELINE=/path/to/pre-cooperative/client.js \
SEMANTIC_WRAP_OPTIONS_BASELINE=/path/to/57f73fd/client.js \
bun run bench:scheduling

SEMANTIC_WRAP_RESIZE_BASELINE=/path/to/pre-cooperative/client.js \
SEMANTIC_WRAP_OPTIONS_BASELINE=/path/to/57f73fd/client.js \
bun run record:scheduling

bun run check
```

Raw metrics, traces, and videos are local diagnostics. Do not commit them. Copy Playwright
output to a separate diagnostics directory before another run overwrites its output.
