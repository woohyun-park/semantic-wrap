---
"@semantic-wrap/core": patch
"@semantic-wrap/react": patch
---

Reduce long-text layout memory and resize work by storing only measured segment widths, reusing hidden DOM measurement probes, and locating native line transitions without scanning every character.
