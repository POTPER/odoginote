export function highlightMatch(text: string, query: string): Array<{ text: string; match: boolean }> {
  if (!query.trim()) return [{ text, match: false }];
  const q = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return [{ text, match: false }];
  const parts: Array<{ text: string; match: boolean }> = [];
  if (idx > 0) parts.push({ text: text.slice(0, idx), match: false });
  parts.push({ text: text.slice(idx, idx + q.length), match: true });
  if (idx + q.length < text.length) {
    parts.push({ text: text.slice(idx + q.length), match: false });
  }
  return parts;
}
