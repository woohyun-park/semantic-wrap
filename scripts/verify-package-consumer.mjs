import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repository = dirname(dirname(fileURLToPath(import.meta.url)));
const temporaryDirectory = mkdtempSync(join(tmpdir(), "semantic-wrap-consumer-"));

function run(command, args, cwd = repository) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

try {
  const tarballs = [
    "@semantic-wrap/core",
    "@semantic-wrap/en",
    "@semantic-wrap/ko",
    "@semantic-wrap/react",
  ]
    .map((workspace) =>
      run("npm", ["pack", "--workspace", workspace, "--pack-destination", temporaryDirectory])
        .split("\n")
        .at(-1),
    )
    .map((filename) => `./${filename}`);

  writeFileSync(
    join(temporaryDirectory, "package.json"),
    JSON.stringify({ private: true, type: "module" }, null, 2),
  );
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      ...tarballs,
      "react@19",
      "react-dom@19",
      "typescript@7",
      "@types/react@19",
      "@types/react-dom@19",
    ],
    temporaryDirectory,
  );

  writeFileSync(
    join(temporaryDirectory, "smoke.mjs"),
    `import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createBudouxPredictor,
  createLineBreakPlan,
  definePhraseModel,
  selectLineBreaks,
} from "@semantic-wrap/core";
import { enTitleModel } from "@semantic-wrap/en";
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "@semantic-wrap/react";

const text = "더 나은 사용자 경험을 만드는 방법";
const result = selectLineBreaks({
  text,
  model: koTitleModel,
  maxWidth: 10,
  measureText: (value) => value.length,
});
assert.equal(result.text, text);
const plan = createLineBreakPlan({ text, model: koTitleModel });
assert.equal(plan.select({ maxWidth: 10, measureText: (value) => value.length }).text, text);
assert.equal(enTitleModel.levels.length, 3);
const customModel = definePhraseModel({
  boundaryMode: "spaces",
  levels: [{
    predictor: createBudouxPredictor({ UW3: { ":": 100 } }),
    penalty: 0,
  }],
  fallbackPenalty: 1,
});
assert.equal(
  selectLineBreaks({
    text: "Review: before approval",
    model: customModel,
    maxWidth: 16,
    measureText: (value) => value.length,
  }).lines.length,
  2,
);
const html = renderToStaticMarkup(
  createElement(SemanticWrap, { model: koTitleModel }, createElement("h1", null, text)),
);
assert.equal(html, \`<h1 style="opacity:0">\${text}</h1>\`);
const progressiveHtml = renderToStaticMarkup(
  createElement(
    SemanticWrap,
    { mode: "progressive", model: koTitleModel },
    createElement("h1", null, text),
  ),
);
assert.equal(progressiveHtml, \`<h1>\${text}</h1>\`);
`,
  );
  run(process.execPath, ["smoke.mjs"], temporaryDirectory);

  writeFileSync(
    join(temporaryDirectory, "consumer.tsx"),
    `import { balance, createBudouxPredictor, createLineBreakPlan, createLineBreakStrategy, definePhraseModel, selectLineBreaks, type BoundaryPredictor, type PhraseModel } from "@semantic-wrap/core";
import { enTitleModel } from "@semantic-wrap/en";
import { koTitleModel } from "@semantic-wrap/ko";
import { SemanticWrap } from "@semantic-wrap/react";

const strategy = createLineBreakStrategy({ select: balance({ tolerance: 0.12 }) });
const selection = selectLineBreaks(
  {
    text: "타입 검증",
    model: koTitleModel,
    maxWidth: 100,
    measureText: (value) => value.length,
  },
  { strategy },
);
const plan = createLineBreakPlan({ text: "타입 검증", model: koTitleModel, strategy });
plan.select({ maxWidth: 100, measureText: (value) => value.length });
selection.selectedCandidates satisfies typeof selection.selectedCandidates;
enTitleModel satisfies PhraseModel;
koTitleModel satisfies PhraseModel;
const predictor: BoundaryPredictor = createBudouxPredictor({ UW3: { ":": 100 } });
definePhraseModel({ levels: [{ predictor, penalty: 0 }], fallbackPenalty: 1 }) satisfies PhraseModel;
const title = <SemanticWrap model={koTitleModel}><h1>타입 검증</h1></SemanticWrap>;
void title;
`,
  );
  writeFileSync(
    join(temporaryDirectory, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          jsx: "react-jsx",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          strict: true,
          target: "ES2022",
        },
        include: ["consumer.tsx"],
      },
      null,
      2,
    ),
  );
  run("npx", ["tsc", "--noEmit"], temporaryDirectory);
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}
