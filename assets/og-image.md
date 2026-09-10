# Social sharing image

- Asset: `apps/docs/public/og-image.png`
- Dimensions: 1200 × 630 pixels; shared by English and Korean metadata.
- Logo: the original `assets/semantic-wrap-lockup.webp`, with only the surrounding black margin trimmed and its aspect ratio preserved.
- Rendered on a 2D canvas with Chromium. No image generation or redrawn logo is used.
- Copy, type weight, font stack, letter spacing, and accent gradient come from the landing's source.
- Headline typography is scaled to 122% of the landing's size at the same viewport width.
- Layout: both headline lines share the same left edge; the original logo sits at the lower right.

## Regenerate

```sh
bun scripts/generate-og-image.ts
```

The script requires the repository's Playwright Chromium installation. The black canvas
matches the original lockup's background so the logo needs no masking or retouching.
