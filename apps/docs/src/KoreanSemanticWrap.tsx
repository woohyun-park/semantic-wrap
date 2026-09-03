import { koTitleModel } from "@semantic-wrap/ko";
import {
  SemanticWrap,
  type SemanticWrapProps,
} from "@semantic-wrap/react";

type KoreanSemanticWrapProps = Pick<SemanticWrapProps, "children">;

/** Applies the shared Korean title model without adding a DOM wrapper. */
export function KoreanSemanticWrap({ children }: KoreanSemanticWrapProps) {
  return <SemanticWrap model={koTitleModel}>{children}</SemanticWrap>;
}
