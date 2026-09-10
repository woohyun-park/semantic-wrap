import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { landingContent } from "../apps/docs/src/landing-content";

const logoUrl = new URL("../assets/semantic-wrap-lockup.webp", import.meta.url);
const outputUrl = new URL("../apps/docs/public/og-image.png", import.meta.url);
const logo = (await readFile(logoUrl)).toString("base64");
const styles = await readFile(new URL("../apps/docs/src/styles.css", import.meta.url), "utf8");
const browser = await chromium.launch();

try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>${styles}</style>
  <style>
    html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
    canvas { display: block; }
    .intro-message-copy { position: absolute; left: -10000px; }
  </style>
</head>
<body>
  <p class="intro-message-copy" aria-hidden="true"></p>
  <canvas width="1200" height="630" aria-label="semantic-wrap sharing image"></canvas>
</body>
</html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async ({ logo, message }) => {
    const canvas = document.querySelector("canvas")!;
    const context = canvas.getContext("2d")!;
    const typography = getComputedStyle(document.querySelector(".intro-message-copy")!);
    const tokens = getComputedStyle(document.documentElement);

    context.fillStyle = tokens.getPropertyValue("--backdrop").trim();
    context.fillRect(0, 0, canvas.width, canvas.height);
    const headlineScale = 1.22;
    const fontSize = Number.parseFloat(typography.fontSize) * headlineScale;
    context.font = `${typography.fontWeight} ${fontSize}px ${typography.fontFamily}`;
    context.letterSpacing = `${Number.parseFloat(typography.letterSpacing) * headlineScale}px`;
    context.fontKerning = "normal";
    context.textBaseline = "alphabetic";

    const left = 64;
    const top = 90;
    const first = context.measureText(message[0]);
    const second = context.measureText(message[1]);
    const firstBaseline = top + first.actualBoundingBoxAscent;
    const secondBaseline = firstBaseline + Number.parseFloat(typography.lineHeight) * headlineScale;
    context.fillStyle = tokens.getPropertyValue("--paper").trim();
    context.fillText(message[0], left + first.actualBoundingBoxLeft, firstBaseline);

    // Convert the landing's CSS gradient direction into canvas coordinates.
    const accent = tokens.getPropertyValue("--accent-gradient");
    const angle = Number(accent.match(/([\d.]+)deg/)![1]) * Math.PI / 180;
    const stops = [...accent.matchAll(/(#[\da-f]+)\s+([\d.]+)%/gi)];
    const width = second.actualBoundingBoxLeft + second.actualBoundingBoxRight;
    const secondLeft = left;
    const height = second.actualBoundingBoxAscent + second.actualBoundingBoxDescent;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const length = Math.abs(width * dx) + Math.abs(height * dy);
    const cx = secondLeft + width / 2;
    const cy = secondBaseline - second.actualBoundingBoxAscent + height / 2;
    const gradient = context.createLinearGradient(
      cx - dx * length / 2, cy - dy * length / 2,
      cx + dx * length / 2, cy + dy * length / 2,
    );
    for (const stop of stops) gradient.addColorStop(Number(stop[2]) / 100, stop[1]!);
    context.fillStyle = gradient;
    context.fillText(message[1], secondLeft + second.actualBoundingBoxLeft, secondBaseline);

    const image = new Image();
    image.src = `data:image/webp;base64,${logo}`;
    await image.decode();
    const source = document.createElement("canvas");
    source.width = image.naturalWidth;
    source.height = image.naturalHeight;
    const sourceContext = source.getContext("2d")!;
    sourceContext.drawImage(image, 0, 0);
    const { data } = sourceContext.getImageData(0, 0, source.width, source.height);
    let minX = source.width;
    let minY = source.height;
    let maxX = 0;
    let maxY = 0;
    // Trim only the empty black margin around the original lockup.
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        const index = (y * source.width + x) * 4;
        if (Math.max(data[index]!, data[index + 1]!, data[index + 2]!) <= 16) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    const sourceWidth = maxX - minX + 1;
    const sourceHeight = maxY - minY + 1;
    const logoWidth = 420;
    const logoHeight = logoWidth * sourceHeight / sourceWidth;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, minX, minY, sourceWidth, sourceHeight,
      canvas.width - 64 - logoWidth, canvas.height - 80 - logoHeight, logoWidth, logoHeight);
  }, { logo, message: landingContent.en.intro.message });
  await page.locator("canvas").screenshot({ path: outputUrl.pathname });
  console.log(`Generated ${outputUrl.pathname} using the original logo at ${logoUrl.pathname}`);
} finally {
  await browser.close();
}
