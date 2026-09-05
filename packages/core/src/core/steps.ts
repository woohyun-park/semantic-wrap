/** Consume the same resumable work synchronously for the existing APIs. */
export function finishSteps<T>(steps: Generator<void, T, void>): T {
  let next = steps.next();
  while (!next.done) next = steps.next();
  return next.value;
}
