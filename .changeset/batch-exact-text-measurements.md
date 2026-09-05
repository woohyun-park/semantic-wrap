---
"@semantic-wrap/core": minor
"@semantic-wrap/react": patch
---

Support optional synchronous `measureTexts` in Core and batch exact DOM width
measurements in React. Preserve the full global search and selected layouts while
reducing repeated layout flushes with a bounded, reusable measurement-probe pool.
