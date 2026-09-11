---
"@semantic-wrap/core": patch
---

Stop treating whitespace runs made only of non-breaking spaces (U+00A0, U+2007, U+202F, U+FEFF) as line-break boundaries in both `spaces` and `characters` modes, so text joined with them is no longer split by an inserted `<br>`.
