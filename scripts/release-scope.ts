const packageFacingPattern = /^packages\/[^/]+\/(?:src\/.+|package\.json|README(?:-[^/]+)?\.md|MODEL_CARD\.md|LICENSE|NOTICE)$/u;
const changesetPattern = /^\.changeset\/(?!README\.md$)[^/]+\.md$/u;

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

export function packageFacingFiles(paths: readonly string[]): string[] {
  return paths.map(normalizePath).filter((path) => packageFacingPattern.test(path));
}

export function changesetFiles(paths: readonly string[]): string[] {
  return paths.map(normalizePath).filter((path) => changesetPattern.test(path));
}

export type ChangesetRequirement = {
  packageFiles: readonly string[];
  changesets: readonly string[];
  required: boolean;
  satisfied: boolean;
};

export function evaluateChangesetRequirement(
  changedPaths: readonly string[],
  addedOrModifiedPaths: readonly string[] = changedPaths,
): ChangesetRequirement {
  const packageFiles = packageFacingFiles(changedPaths);
  const changesets = changesetFiles(addedOrModifiedPaths);
  const required = packageFiles.length > 0;
  return {
    packageFiles,
    changesets,
    required,
    satisfied: !required || changesets.length > 0,
  };
}
