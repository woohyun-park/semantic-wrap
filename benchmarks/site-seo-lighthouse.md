# Site SEO and Lighthouse

## Scope

Improve the four English/Korean landing and introduction pages. Preserve package
APIs and existing typography interactions. Work on `improve/site-seo-lighthouse`.
Implementation is authorized; deployment, push, and PR creation are not part of this task.

## Plan

1. Record mobile/desktop Lighthouse baselines, three runs per URL.
2. Serve robots/sitemap files, canonical redirects, and real missing-page responses.
3. Prerender readable content and hydrate without browser-only render dependencies.
4. Split landing/docs loading; optimize measured bottlenecks and accessibility failures.
5. Add content/routing/hydration regressions and Lighthouse CI artifacts/budgets.
6. Run focused browser checks and the final `bun run check`.

## Measurement

Build with `bun run site:build`, then run `bun run site:audit`. The audit runner
owns and stops its preview on port 4193. Set `LIGHTHOUSE_ORIGIN` to audit an existing
server instead. Do not overlap
Lighthouse with browser tests or other performance work. Reports are ignored under
`dogfood-output/lighthouse/`; CI retains them as artifacts. Use `LIGHTHOUSE_OUTPUT`
to retain separate before/after runs and `LIGHTHOUSE_ASSERT=0` to collect a baseline.
The runner records the pinned Lighthouse and Playwright Chromium versions with results.
Local preview tests HTML/JavaScript performance; production redirects, compression,
cache headers, and field Core Web Vitals require post-deployment checks.

## Results

Measured on macOS with Lighthouse 13.4.1 and Playwright Chromium 151.0.0.0,
using the same local production preview and Lighthouse's default simulated
throttling. Scores and timings are medians of three separate cold runs per profile
and URL. They are lab measurements, not field Core Web Vitals or search rankings.

Baseline mobile Performance: `/` 96, `/ko` 89, both introduction pages 98.
Baseline desktop Performance: 100 on all four routes. All baseline routes had
Accessibility 96, Best Practices 100, and SEO 92.

| Mobile route | Performance before → after | LCP before → after | TBT before → after |
| --- | --- | --- | --- |
| `/` | 96 → 96 | 2.30 → 2.27 s | 86 → 4 ms |
| `/ko` | 89 → 92 | 3.13 → 2.72 s | 93 → 0 ms |
| `/docs/introduction` | 98 → 98 | 2.18 → 2.11 s | 45.5 → 0 ms |
| `/ko/docs/introduction` | 98 → 98 | 2.18 → 2.11 s | 50 → 0 ms |

Final Accessibility, Best Practices, and SEO are 100 for all routes on both
profiles; desktop Performance remains 100. Median CLS is 0 throughout.
Korean landing lab LCP is still above 2.5 s; remaining work can target its font
stylesheet/render dependency chain. These results do not establish field INP or
Core Web Vitals compliance. The initial CI gates are Performance ≥90 and each
other category ≥95, applied to medians; hosted CI hardware has not been measured
in this local implementation session.

The baseline SEO failure was an HTML response at `/robots.txt`. Accessibility
findings included faded process descriptions (2.72:1 contrast), code comments
(4.15:1), and a copy button name that omitted its visible command.

### Implementation

- Prerender all four page bodies and hydrate the same React tree. Render native
  text in site wrappers so headings are readable before browser measurement.
- Pass locale/model through a site-only provider and load only the selected model.
- Split landing/docs modules and CSS; docs no longer request demo font files.
- Keep the initial hero and descriptive content visible, including without JS.
- Serve a sitemap and valid robots file; limit production rewrites to actual pages,
  normalize aliases, and return 404 for missing routes/assets.
- Preserve locale-link hashes after pushState, back/forward, and direct navigation.
- Fix measured contrast and accessible-name findings; enforce CI score budgets.

Vite 8 initially merged the dependencies of conditional import expressions,
preloading the landing CSS on docs routes and the other language model. Separate
awaited branches avoid that merge. A browser regression checks actual requested
JS/CSS/model files, including the absence of font requests on docs pages.

Initial JS (sum of gzip sizes of required chunks, not just the entry file) changed
from 148.46 kB to 132.59/132.30 kB on English/Korean landing pages and
116.88/116.60 kB on English/Korean docs. Initial CSS changed from 35.44 kB to
33.21 kB on landing pages and 9.25 kB on docs. Font binaries are counted separately
in Lighthouse network reports, not included in these JS/CSS figures.

### Verification

- `bun run check`: passed; 75 unit tests, 261 browser tests across Chromium,
  Firefox, and WebKit; 33 opt-in benchmark tests skipped. Package builds, type
  checks, generated-doc checks, package contents, and publint passed.
- Focused Chromium checks cover JS-disabled content, hydration/motion preferences,
  crawler responses, asset separation, and language-switch/history behavior.
- Development routes `/ko` and `/docs/introduction` returned localized metadata
  and rendered without page errors; mobile landing/docs screenshots inspected.
- `LIGHTHOUSE_OUTPUT=dogfood-output/lighthouse-final bun run site:audit`: passed
  all score budgets across 24 final runs. Baseline reports are retained locally
  under `dogfood-output/lighthouse-before/`; final reports and `summary.json` are
  under `dogfood-output/lighthouse-final/`. The runner stopped its owned server.

Production deployment is outside this implementation. After deployment, verify
canonical redirects and 404 responses against the production host, check actual
cache/compression headers, and inspect indexing/field metrics in Search Console
when access and sufficient traffic are available. No package changeset is needed.
