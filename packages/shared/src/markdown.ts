export interface HeadingItem {
  level: number;
  text: string;
  line: number;
  slug: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "heading";
}

export function extractHeadings(content: string): HeadingItem[] {
  const lines = content.split(/\r?\n/);
  const items: HeadingItem[] = [];
  const slugCounts = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;

    const level = match[1].length;
    const text = match[2].trim();
    const base = slugify(text);
    const count = slugCounts.get(base) ?? 0;
    slugCounts.set(base, count + 1);
    const slug = count > 0 ? `${base}-${count}` : base;

    items.push({ level, text, line: i, slug });
  }

  return items;
}

export function aggregateTags(notes: { tags: string[] }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.tags) {
      const key = tag.trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }
  return map;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
