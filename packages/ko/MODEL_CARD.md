# Korean title preset model card

## Status

Experimental. The bundled model is a domain-specific starting point for Korean display
titles, not a general Korean language model or a production accuracy guarantee.

## Versioning

The `@semantic-wrap/ko` package version is the deployed model version. Documentation-only
changes use patch releases, weight or penalty changes use minor releases, and incompatible
model-schema changes use major releases. Pin the exact package version when line-break output
must be reproducible.

## Intended use

- Short Korean display titles and headings
- Usually one to three rendered lines
- Text whose normal break opportunities are ASCII spaces
- `balanceSelector({ tolerance: 0.12 })` or a product-specific selector

The preset is not intended for body copy, arbitrary HTML, vertical writing, or automatic
character breaking inside overlong identifiers.

## Phrase boundary model

The package bundles one three-level preset. Each level is a BudouX-format model trained with
cumulative targets, so broader levels include every boundary from the stricter levels:

| Level | Penalty | Training boundaries |
| --- | ---: | ---: |
| coarse | 0 | 100 |
| medium | 0.35 | 165 |
| fine | 0.7 | 313 |

Unpredicted source-space boundaries remain available with penalty `1`. The preset never
invents a boundary inside a Korean word.

The training corpus contains 100 independently authored Korean article-title examples and
664 candidate spaces. A single blind reviewer assigned meaning-oriented `protected`, `fine`,
`medium`, or `coarse` pseudo-labels. These labels are not human ground truth.

Positive scales were selected on an 80-title fit and 20-title density-calibration split, then
the deployed weights were refit on all 100 titles:

- coarse: 4
- medium: 2
- fine: 1

The descriptive cumulative F1 values on those same 20 calibration titles were `0.650`,
`0.543`, and `0.837`. Because this split also influenced scale selection, these numbers are
pipeline diagnostics rather than unbiased accuracy estimates.

Model SHA-256 hashes:

- coarse: `7c8e0102945002aa4cea946d8afb71295d10810315cc61ea63679ac224fc93a2`
- medium: `5aca4c2cb38b5659af68080c98f5e88771e2371cf5bdd1a91dd07ea0ccfe4edd`
- fine: `170bc8868c263f90b87bf8cc780cc23803eaf3f5368071918a19bee2aac1bb54`

## Model selection

The cumulative semantic-only preset was selected after local blind layout comparisons. It is
the only model included in this package and the only bundled preset in its public API.

## Known limitations

- The corpus is small and reflects one title-writing style.
- The labels come from one reviewer and can encode subjective grouping preferences.
- Font, width, browser engine, punctuation, English identifiers, and content normalization
  can change the final layout.
- BudouX uses local character features. “Semantic-aware” refers to the meaning-oriented
  training labels, not full syntactic or semantic understanding.
- The reported calibration metrics are not a final held-out benchmark.

## Data and privacy

No source titles, IDs, API keys, review results, or allowlists are included in the runtime
package. The package contains only the three weight tables and preset metadata.

## Recommended validation

Before production use, evaluate the frozen model and `0.12` tolerance on unseen titles
rendered in the application's actual fonts and widths.
