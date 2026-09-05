---
"@semantic-wrap/core": minor
"@semantic-wrap/react": minor
---

Keep precise initial rendering synchronous, but show native source wrapping during resize
and commit only the latest settled exact result. Share resumable calculation with synchronous
Core APIs through `selectSteps` and optional calculator `steps`, and reuse bounded exact
segment widths across resizes with an explicit measurement metric identity.

This changes precise resize timing: hook selection can be null while native text is visible,
and final semantic wrapping may arrive after resizing stops. Progressive behavior is unchanged.
