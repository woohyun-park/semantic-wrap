# English title preset model card

## Status

Experimental. The bundled model is a domain-specific starting point for English display
titles, not a general English language model or a production accuracy guarantee.

## Versioning

The `@semantic-wrap/en` package version is the deployed model version. Documentation-only
changes use patch releases, weight or penalty changes use minor releases, and incompatible
model-schema changes use major releases. Pin the exact package version when line-break output
must be reproducible.

## Intended use

- Short English display titles and headings
- Usually one to three rendered lines
- Text whose normal break opportunities are ASCII spaces
- The default `balance({ tolerance: 0.12 })` selection or a product-specific strategy

The preset is not intended for body copy, hyphenation, arbitrary HTML, vertical writing, or
automatic character breaking inside words.

## Phrase boundary model

The package bundles one three-level preset. Each level is a BudouX-format model trained with
cumulative targets, so broader levels include every boundary from the stricter levels:

| Level | Penalty | Training boundaries |
| --- | ---: | ---: |
| coarse | 0 | 100 |
| medium | 0.35 | 160 |
| fine | 0.7 | 257 |

Unpredicted source-space boundaries remain available with penalty `1`. The preset never
invents a boundary inside an English word.

The training corpus contains 100 original English title examples generated for this
experiment and 897 candidate spaces. A single AI-assisted labeling pass assigned
meaning-oriented `protected`, `fine`, `medium`, or `coarse` pseudo-labels. These labels are
not human ground truth.

Positive scales were selected by matching prediction density on an 80-title fit and 20-title
calibration split, then the deployed weights were refit on all 100 titles:

- coarse: 4
- medium: 4
- fine: 2

The descriptive cumulative F1 values on those same 20 calibration titles were `0.412`,
`0.486`, and `0.583`. Because the split also influenced scale selection, these numbers are
pipeline diagnostics rather than unbiased accuracy estimates.

Model SHA-256 hashes:

- coarse: `e57521ae39f0a7216137963062fd6d0ca90f7d2af243e4c946ca3056675ea4e9`
- medium: `3661905c25d998b26ca6fcd60ffaa88e90a813dcd1fe84234fae5fabb3799027`
- fine: `a8bf497a49a6f1452d49c07ce54fd08387fea3a709363b0851255a9836ab61f2`

## Known limitations

- The corpus is small and reflects one title-writing style.
- The labels come from one AI-assisted pass and can encode subjective grouping preferences.
- BudouX uses local character features, so it does not parse English syntax or meaning.
- Font, width, browser engine, punctuation, and content normalization can change the final
  layout.
- The model does not provide hyphenation or word-internal break opportunities.
- The reported calibration metrics are not a final held-out benchmark.

## Data and privacy

The source titles were written for this experiment rather than copied from an external title
corpus. No source titles, review results, or allowlists are included in the runtime package.
The package contains only the three weight tables and preset metadata.

## Recommended validation

Before production use, evaluate the frozen model on unseen titles rendered in the
application's actual fonts and widths.
