export interface TextEdit {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export function toTextEdit(
  text: string,
  cursor: number,
  selectionEnd?: number
): TextEdit {
  return { text, selectionStart: cursor, selectionEnd: selectionEnd ?? cursor };
}

export function wrapSelection(
  content: string,
  start: number,
  end: number,
  before: string,
  after: string = before
): TextEdit {
  const selected = content.slice(start, end);
  const replacement = before + selected + after;
  const text = content.slice(0, start) + replacement + content.slice(end);
  const selectionStart = selected ? start + replacement.length : start + before.length;
  return { text, selectionStart, selectionEnd: selectionStart };
}

export interface WikiLinkContext {
  query: string;
  openIdx: number;
}

export interface CompletedWikiLink {
  target: string;
  start: number;
  end: number;
}

const COMPLETED_WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;
const LIST_LINE_RE = /^(\s*)([-*+]|\d+\.)\s(.*)$/;
const EMPTY_LIST_RE = /^(\s*)([-*+])\s*$/;
const EMPTY_ORDERED_LIST_RE = /^(\s*)(\d+)\.\s*$/;
const BLOCKQUOTE_LINE_RE = /^(\s*)(>+)\s?(.*)$/;
const HEADING_LINE_RE = /^(#{1,6})\s+(.*)$/;

const URL_RE = /^https?:\/\/[^\s]+$/i;

const PAIR_CHARS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
};

export interface LineContext {
  lineIndex: number;
  lineStart: number;
  lineEnd: number;
  lineText: string;
  indent: string;
  /** List/blockquote/heading marker prefix including trailing space where applicable */
  marker: string;
  contentAfterMarker: string;
}

export function getLineAt(text: string, lineIndex: number): { start: number; end: number; text: string } {
  const lines = text.split("\n");
  let start = 0;
  for (let i = 0; i < lineIndex; i++) {
    start += lines[i].length + 1;
  }
  const lineText = lines[lineIndex] ?? "";
  return { start, end: start + lineText.length, text: lineText };
}

export function getLineIndex(text: string, cursor: number): number {
  return text.slice(0, cursor).split("\n").length - 1;
}

export function getLineContext(text: string, cursor: number): LineContext {
  const lineIndex = getLineIndex(text, cursor);
  const { start, end, text: lineText } = getLineAt(text, lineIndex);

  const listMatch = lineText.match(LIST_LINE_RE);
  if (listMatch) {
    return {
      lineIndex,
      lineStart: start,
      lineEnd: end,
      lineText,
      indent: listMatch[1],
      marker: listMatch[2] + " ",
      contentAfterMarker: listMatch[3],
    };
  }

  const quoteMatch = lineText.match(BLOCKQUOTE_LINE_RE);
  if (quoteMatch) {
    return {
      lineIndex,
      lineStart: start,
      lineEnd: end,
      lineText,
      indent: quoteMatch[1],
      marker: quoteMatch[2] + " ",
      contentAfterMarker: quoteMatch[3],
    };
  }

  const headingMatch = lineText.match(HEADING_LINE_RE);
  if (headingMatch) {
    return {
      lineIndex,
      lineStart: start,
      lineEnd: end,
      lineText,
      indent: "",
      marker: headingMatch[1] + " ",
      contentAfterMarker: headingMatch[2],
    };
  }

  const indentMatch = lineText.match(/^(\s*)/);
  return {
    lineIndex,
    lineStart: start,
    lineEnd: end,
    lineText,
    indent: indentMatch?.[1] ?? "",
    marker: "",
    contentAfterMarker: lineText.trimStart(),
  };
}

export function getSelectedLineRange(
  text: string,
  selectionStart: number,
  selectionEnd: number
): { firstLine: number; lastLine: number } {
  const firstLine = getLineIndex(text, selectionStart);
  const lastLine = getLineIndex(text, Math.max(selectionStart, selectionEnd - 1));
  return { firstLine, lastLine };
}

export function getCompletedWikiLinkAtCursor(
  content: string,
  cursor: number
): CompletedWikiLink | null {
  const re = new RegExp(COMPLETED_WIKI_LINK_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (cursor >= start && cursor <= end) {
      return { target: m[1].trim(), start, end };
    }
  }
  return null;
}

export function getWikiLinkContext(content: string, cursor: number): WikiLinkContext | null {
  const before = content.slice(0, cursor);
  const openIdx = before.lastIndexOf("[[");
  if (openIdx === -1) return null;

  const fragment = before.slice(openIdx + 2);
  if (fragment.includes("]]") || fragment.includes("\n")) return null;

  return { query: fragment, openIdx };
}

export function applyWikiLink(
  content: string,
  title: string,
  openIdx: number,
  cursor: number
): TextEdit {
  const before = content.slice(0, openIdx);
  const after = content.slice(cursor);
  const link = `[[${title}]]`;
  const text = before + link + after;
  const selectionStart = openIdx + link.length;
  return { text, selectionStart, selectionEnd: selectionStart };
}

/** Enter on list line: continue or exit empty item */
export function handleListEnter(text: string, cursor: number): TextEdit | null {
  const ctx = getLineContext(text, cursor);
  const cursorInLine = cursor - ctx.lineStart;

  const listMatch = ctx.lineText.match(LIST_LINE_RE);
  if (listMatch) {
    const [, indent, marker, contentAfter] = listMatch;
    const isEmpty = contentAfter.trim() === "" && cursorInLine >= indent.length + marker.length + 1;

    if (isEmpty || EMPTY_LIST_RE.test(ctx.lineText) || EMPTY_ORDERED_LIST_RE.test(ctx.lineText)) {
      const newLineText = indent;
      const textBefore = text.slice(0, ctx.lineStart);
      const textAfter = text.slice(ctx.lineEnd);
      const next = textBefore + newLineText + "\n" + textAfter;
      const selectionStart = ctx.lineStart + newLineText.length + 1;
      return { text: next, selectionStart, selectionEnd: selectionStart };
    }

    let nextMarker: string;
    const orderedMatch = marker.match(/^(\d+)\.$/);
    if (orderedMatch) {
      nextMarker = `${parseInt(orderedMatch[1], 10) + 1}. `;
    } else {
      nextMarker = `${marker} `;
    }

    const insert = `\n${indent}${nextMarker}`;
    const next = text.slice(0, cursor) + insert + text.slice(cursor);
    const selectionStart = cursor + insert.length;
    return { text: next, selectionStart, selectionEnd: selectionStart };
  }

  return null;
}

/** Enter on blockquote line: continue or exit empty quote */
export function handleBlockquoteEnter(text: string, cursor: number): TextEdit | null {
  const ctx = getLineContext(text, cursor);
  const quoteMatch = ctx.lineText.match(BLOCKQUOTE_LINE_RE);
  if (!quoteMatch) return null;

  const [, indent, markers, contentAfter] = quoteMatch;
  const markerPrefix = markers + " ";
  const isEmpty = contentAfter.trim() === "";

  if (isEmpty) {
    const newLineText = indent;
    const textBefore = text.slice(0, ctx.lineStart);
    const textAfter = text.slice(ctx.lineEnd);
    const next = textBefore + newLineText + "\n" + textAfter;
    const selectionStart = ctx.lineStart + newLineText.length + 1;
    return { text: next, selectionStart, selectionEnd: selectionStart };
  }

  const insert = `\n${indent}${markerPrefix}`;
  const next = text.slice(0, cursor) + insert + text.slice(cursor);
  const selectionStart = cursor + insert.length;
  return { text: next, selectionStart, selectionEnd: selectionStart };
}

/** Tab / Shift+Tab indent or outdent selected lines */
export function indentLines(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  outdent: boolean
): TextEdit {
  const lines = text.split("\n");
  const { firstLine, lastLine } = getSelectedLineRange(text, selectionStart, selectionEnd);
  const indentUnit = "  ";

  const origLengths: number[] = [];
  for (let i = firstLine; i <= lastLine; i++) {
    origLengths.push(lines[i].length);
    if (outdent) {
      if (lines[i].startsWith(indentUnit)) lines[i] = lines[i].slice(indentUnit.length);
      else if (lines[i].startsWith("\t")) lines[i] = lines[i].slice(1);
      else if (lines[i].startsWith(" ")) lines[i] = lines[i].slice(1);
    } else {
      lines[i] = indentUnit + lines[i];
    }
  }

  const next = lines.join("\n");
  let startDelta = 0;
  let endDelta = 0;
  for (let i = firstLine; i <= lastLine; i++) {
    const delta = lines[i].length - origLengths[i - firstLine];
    if (i === firstLine && selectionStart > getLineAt(text, i).start) {
      startDelta += delta;
    }
    endDelta += delta;
  }

  if (firstLine === lastLine && selectionStart === selectionEnd) {
    startDelta = outdent ? -Math.min(2, origLengths[0] - lines[firstLine].length) : indentUnit.length;
    endDelta = startDelta;
  }

  return {
    text: next,
    selectionStart: Math.max(0, selectionStart + startDelta),
    selectionEnd: Math.max(0, selectionEnd + endDelta),
  };
}

export function handleFormatShortcut(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  key: string
): TextEdit | null {
  const mod = key.toLowerCase();
  if (mod === "b") return wrapSelection(text, selectionStart, selectionEnd, "**");
  if (mod === "i") return wrapSelection(text, selectionStart, selectionEnd, "*");
  if (key === "`") return wrapSelection(text, selectionStart, selectionEnd, "`");
  return null;
}

export function handlePairInput(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  char: string
): TextEdit | null {
  const close = PAIR_CHARS[char];
  if (!close) return null;

  const hasSelection = selectionStart !== selectionEnd;
  if (hasSelection) {
    return wrapSelection(text, selectionStart, selectionEnd, char, close);
  }

  const insert = char + close;
  const next = text.slice(0, selectionStart) + insert + text.slice(selectionEnd);
  const cursor = selectionStart + 1;
  return { text: next, selectionStart: cursor, selectionEnd: cursor };
}

export function handleSmartPasteUrl(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  pasted: string
): TextEdit | null {
  if (selectionStart === selectionEnd) return null;
  const trimmed = pasted.trim();
  if (!URL_RE.test(trimmed)) return null;

  const selected = text.slice(selectionStart, selectionEnd);
  const link = `[${selected}](${trimmed})`;
  const next = text.slice(0, selectionStart) + link + text.slice(selectionEnd);
  const cursor = selectionStart + link.length;
  return { text: next, selectionStart: cursor, selectionEnd: cursor };
}

export function toggleHeading(text: string, cursor: number): TextEdit {
  const ctx = getLineContext(text, cursor);
  const headingMatch = ctx.lineText.match(HEADING_LINE_RE);

  let newLineText: string;
  if (headingMatch) {
    const level = headingMatch[1].length;
    if (level >= 6) {
      newLineText = headingMatch[2];
    } else {
      newLineText = "#".repeat(level + 1) + " " + headingMatch[2];
    }
  } else {
    newLineText = "# " + ctx.lineText;
  }

  const next = text.slice(0, ctx.lineStart) + newLineText + text.slice(ctx.lineEnd);
  const cursorOffset = cursor - ctx.lineStart;
  let newCursor = ctx.lineStart + Math.min(cursorOffset + (newLineText.length - ctx.lineText.length), newLineText.length);
  if (!headingMatch) newCursor = ctx.lineStart + 2;

  return { text: next, selectionStart: newCursor, selectionEnd: newCursor };
}

export function deleteLine(text: string, cursor: number): TextEdit {
  const lineIndex = getLineIndex(text, cursor);
  const lines = text.split("\n");
  if (lines.length <= 1) {
    return { text: "", selectionStart: 0, selectionEnd: 0 };
  }

  const { start } = getLineAt(text, lineIndex);
  let removeStart = start;
  let removeEnd = start + lines[lineIndex].length;

  if (lineIndex < lines.length - 1) {
    removeEnd += 1;
  } else if (lineIndex > 0) {
    removeStart -= 1;
  }

  const next = text.slice(0, removeStart) + text.slice(removeEnd);
  const selectionStart = Math.min(removeStart, next.length);
  return { text: next, selectionStart, selectionEnd: selectionStart };
}

export function moveLine(text: string, cursor: number, direction: "up" | "down"): TextEdit | null {
  const lineIndex = getLineIndex(text, cursor);
  const lines = text.split("\n");
  const targetIndex = direction === "up" ? lineIndex - 1 : lineIndex + 1;
  if (targetIndex < 0 || targetIndex >= lines.length) return null;

  [lines[lineIndex], lines[targetIndex]] = [lines[targetIndex], lines[lineIndex]];
  const next = lines.join("\n");

  const cursorInLine = cursor - getLineAt(text, lineIndex).start;
  const newLineStart = getLineAt(next, targetIndex).start;
  const newLineLen = lines[targetIndex].length;
  const selectionStart = newLineStart + Math.min(cursorInLine, newLineLen);

  return { text: next, selectionStart, selectionEnd: selectionStart };
}

export function insertAtSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  insert: string
): TextEdit {
  const next = text.slice(0, selectionStart) + insert + text.slice(selectionEnd);
  const cursor = selectionStart + insert.length;
  return { text: next, selectionStart: cursor, selectionEnd: cursor };
}
