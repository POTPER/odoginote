import type { NoteSummary } from "./types.js";

const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

export function extractWikiLinks(content: string): string[] {
  const links: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(WIKI_LINK_RE.source, "g");
  while ((m = re.exec(content)) !== null) {
    links.push(m[1].trim());
  }
  return links;
}

export function resolveLink(target: string, notes: NoteSummary[]): number | null {
  const t = target.trim();
  if (t.startsWith("#")) {
    const num = parseInt(t.slice(1), 10);
    if (!isNaN(num) && notes.some((n) => n.number === num)) return num;
  }
  const exact = notes.find((n) => n.title === t);
  if (exact) return exact.number;
  const lower = t.toLowerCase();
  const fuzzy = notes.find((n) => n.title.toLowerCase() === lower);
  return fuzzy?.number ?? null;
}

export interface GraphNode {
  id: number;
  title: string;
}

export interface GraphEdge {
  source: number;
  target: number;
}

export function buildGraph(notes: NoteSummary[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = notes.map((n) => ({ id: n.number, title: n.title }));
  const edges: GraphEdge[] = [];
  for (const note of notes) {
    if (!note.content) continue;
    for (const link of extractWikiLinks(note.content)) {
      const target = resolveLink(link, notes);
      if (target != null && target !== note.number) {
        edges.push({ source: note.number, target });
      }
    }
  }
  return { nodes, edges };
}

export function findBacklinks(
  _targetTitle: string,
  targetNumber: number,
  notes: NoteSummary[]
): NoteSummary[] {
  return notes.filter((n) => {
    if (n.number === targetNumber || !n.content) return false;
    return extractWikiLinks(n.content).some((link) => resolveLink(link, notes) === targetNumber);
  });
}
