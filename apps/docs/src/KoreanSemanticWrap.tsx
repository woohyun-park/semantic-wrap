import { useTitleModel } from "./site-models";
import {
  SemanticWrap,
  type SemanticWrapProps,
} from "@semantic-wrap/react";

type KoreanSemanticWrapProps = Pick<SemanticWrapProps, "children">;

/** Applies the shared Korean title model without adding a DOM wrapper. */
export function KoreanSemanticWrap({ children }: KoreanSemanticWrapProps) {
  const model = useTitleModel("ko");
  return <SemanticWrap model={model} initial="native">{children}</SemanticWrap>;
}
