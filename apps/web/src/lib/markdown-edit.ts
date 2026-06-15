export function wrapSelection(
  content: string,
  start: number,
  end: number,
  before: string,
  after: string = before
): { next: string; cursor: number } {
  const selected = content.slice(start, end);
  const replacement = before + selected + after;
  const next = content.slice(0, start) + replacement + content.slice(end);
  const cursor = selected
    ? start + replacement.length
    : start + before.length;
  return { next, cursor };
}

export interface WikiLinkContext {
  query: string;
  openIdx: number;
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
): { next: string; cursor: number } {
  const before = content.slice(0, openIdx);
  const after = content.slice(cursor);
  const link = `[[${title}]]`;
  const next = before + link + after;
  return { next, cursor: openIdx + link.length };
}
