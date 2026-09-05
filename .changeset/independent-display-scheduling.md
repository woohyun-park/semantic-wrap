---
"@semantic-wrap/react": minor
---

Separate first display (`initial="resolved" | "native"`) from resize scheduling
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
