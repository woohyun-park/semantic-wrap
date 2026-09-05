import {
  createTextMeasurementCache,
  createTextMeasurer,
  invalidateTextMeasurementCache,
} from "../../packages/react/src/dom-measure.js";

export function installBatchWidthChecks() {
  Reflect.set(window, "__batchWidthChecks", async () => {
    await document.fonts.ready;
    const element = document.createElement("p");
    element.style.cssText = "font:600 23.5px/1.45 system-ui;letter-spacing:-0.035em";
    document.body.append(element);
    const cache = createTextMeasurementCache();
    const scalarCache = createTextMeasurementCache();
    const texts = [
      "",
      " ",
      "a  b",
      "a\tb",
      "a\nb",
      "  a\r\nb ",
      "👩‍💻 e\u0301 🙂",
      "office AV ffi",
      "مرحبا بالعالم",
      "더 나은 제품을 만들기 위해 팀이 버려야 할 습관",
      ...Array.from({ length: 140 }, (_, i) => `항목 ${i} / item ${i}`),
    ];
    const rows = [];
    const oldProbes: HTMLElement[] = [];
    try {
      for (const whiteSpace of ["normal", "pre", "pre-wrap", "pre-line", "break-spaces"]) {
        for (const fontSize of ["16px", "31px"]) {
          element.style.whiteSpace = whiteSpace;
          element.style.fontSize = fontSize;
          element.style.fontKerning = "normal";
          element.style.wordSpacing = "1.2px";
          const batch = createTextMeasurer(element, cache, texts.join(" "));
          const scalar = createTextMeasurer(element, scalarCache, texts.join(" "));
          const input = [...texts, ...texts.slice(0, 10)];
          const actual = batch.measureTexts(input);
          const expected = input.map(scalar.measureText);
          const probes = [cache.probe, ...cache.batchProbes].filter(
            (probe): probe is HTMLSpanElement => probe !== null,
          );
          const again = batch.measureTexts(input);
          rows.push({
            whiteSpace,
            fontSize,
            actual,
            expected,
            again,
            probes: probes.length,
            widths: cache.widths.size,
            reused: probes.every(
              (probe) =>
                probe.isConnected && (probe === cache.probe || cache.batchProbes.includes(probe)),
            ),
            oldConnected: oldProbes.filter((probe) => probe.isConnected).length,
          });
          oldProbes.push(...probes);
        }
      }
    } finally {
      invalidateTextMeasurementCache(cache);
      invalidateTextMeasurementCache(scalarCache);
      element.remove();
    }
    return { rows, remaining: oldProbes.filter((probe) => probe.isConnected).length };
  });
}
