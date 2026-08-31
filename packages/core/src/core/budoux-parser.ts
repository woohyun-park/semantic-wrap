/**
 * @license
 * Copyright 2021 Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Modified by Woohyun Park in 2026 for semantic-wrap's dependency-free
 * BudouX model inference.
 */

import type { BudouxModel } from "./types.js";

/** Minimal, dependency-free inference for BudouX JSON models. */
export class BudouxParser {
  readonly #model: Map<string, Map<string, number>>;
  readonly #baseScore: number;

  constructor(model: BudouxModel) {
    this.#model = new Map(
      Object.entries(model).map(([group, values]) => [group, new Map(Object.entries(values))]),
    );
    this.#baseScore =
      -0.5 *
      [...this.#model.values()]
        .flatMap((group) => [...group.values()])
        .reduce((sum, value) => sum + value, 0);
  }

  parseBoundaries(sentence: string): number[] {
    const result: number[] = [];
    const score = (group: string, feature: string) => this.#model.get(group)?.get(feature) ?? 0;
    for (let offset = 1; offset < sentence.length; offset += 1) {
      let total = this.#baseScore;
      total += score("UW1", sentence.substring(offset - 3, offset - 2));
      total += score("UW2", sentence.substring(offset - 2, offset - 1));
      total += score("UW3", sentence.substring(offset - 1, offset));
      total += score("UW4", sentence.substring(offset, offset + 1));
      total += score("UW5", sentence.substring(offset + 1, offset + 2));
      total += score("UW6", sentence.substring(offset + 2, offset + 3));
      total += score("BW1", sentence.substring(offset - 2, offset));
      total += score("BW2", sentence.substring(offset - 1, offset + 1));
      total += score("BW3", sentence.substring(offset, offset + 2));
      total += score("TW1", sentence.substring(offset - 3, offset));
      total += score("TW2", sentence.substring(offset - 2, offset + 1));
      total += score("TW3", sentence.substring(offset - 1, offset + 2));
      total += score("TW4", sentence.substring(offset, offset + 3));
      if (total > 0) result.push(offset);
    }
    return result;
  }
}
