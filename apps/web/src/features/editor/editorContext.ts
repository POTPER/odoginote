import type { RefObject } from "react";
import type { TextEdit } from "../../lib/markdown-edit";

export interface EditorContext {
  text: string;
  selectionStart: number;
  selectionEnd: number;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export type EditorHandler = (
  ctx: EditorContext,
  e: KeyboardEvent
) => TextEdit | null | "consumed";

export interface WikiSuggestState {
  query: string;
  openIdx: number;
  cursor: number;
  activeIndex: number;
}
