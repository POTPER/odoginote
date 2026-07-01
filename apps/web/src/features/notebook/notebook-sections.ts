import { getOutputText, type JupyterCell, type JupyterOutput } from "@odoginote/shared";

export interface GinoteCellMetadata {
  sectionCollapsed?: boolean;
  outputCollapsed?: boolean | undefined;
}

export interface SectionGroup {
  headerIndex: number;
  memberIndices: number[];
}

const SECTION_HEADER_RE = /^#{1,2}\s+\S/;

export function getGinoteMetadata(cell: JupyterCell): GinoteCellMetadata {
  const ginote = cell.metadata?.ginote;
  if (!ginote || typeof ginote !== "object") return {};
  const meta = ginote as Record<string, unknown>;
  return {
    sectionCollapsed: meta.sectionCollapsed === true,
    outputCollapsed:
      meta.outputCollapsed === true
        ? true
        : meta.outputCollapsed === false
          ? false
          : undefined,
  };
}

export function mergeGinoteMetadata(
  cell: JupyterCell,
  patch: Partial<GinoteCellMetadata>
): Record<string, unknown> {
  const current = getGinoteMetadata(cell);
  const next: GinoteCellMetadata = { ...current, ...patch };
  const ginote: Record<string, boolean> = {};
  if (next.sectionCollapsed) ginote.sectionCollapsed = true;
  if (next.outputCollapsed === true) ginote.outputCollapsed = true;
  else if (next.outputCollapsed === false) ginote.outputCollapsed = false;
  return {
    ...cell.metadata,
    ginote: Object.keys(ginote).length > 0 ? ginote : undefined,
  };
}

export function isSectionHeaderCell(cell: JupyterCell): boolean {
  if (cell.cell_type !== "markdown") return false;
  const firstLine = cell.source.split("\n").find((line) => line.trim()) ?? "";
  return SECTION_HEADER_RE.test(firstLine.trim());
}

export function parseSectionHeader(source: string): { title: string; description: string } {
  const lines = source.split("\n");
  const firstIdx = lines.findIndex((line) => line.trim());
  if (firstIdx < 0) return { title: "", description: "" };
  const titleLine = lines[firstIdx].trim();
  const title = titleLine.replace(/^#{1,2}\s+/, "").trim();
  const description = lines
    .slice(firstIdx + 1)
    .join("\n")
    .trim();
  return { title, description };
}

export function buildSectionGroups(cells: JupyterCell[]): SectionGroup[] {
  const groups: SectionGroup[] = [];
  let current: SectionGroup | null = null;

  for (let i = 0; i < cells.length; i++) {
    if (isSectionHeaderCell(cells[i])) {
      current = { headerIndex: i, memberIndices: [] };
      groups.push(current);
      continue;
    }
    if (current) current.memberIndices.push(i);
  }

  return groups;
}

export function buildHiddenBySection(cells: JupyterCell[]): Set<number> {
  const hidden = new Set<number>();
  for (const group of buildSectionGroups(cells)) {
    const header = cells[group.headerIndex];
    if (!getGinoteMetadata(header).sectionCollapsed) continue;
    for (const idx of group.memberIndices) hidden.add(idx);
  }
  return hidden;
}

export function findSectionHeaderForCell(cells: JupyterCell[], cellIndex: number): number | null {
  let header: number | null = null;
  for (let i = 0; i <= cellIndex; i++) {
    if (isSectionHeaderCell(cells[i])) header = i;
  }
  return header;
}

export const OUTPUT_COLLAPSE_LINE_THRESHOLD = 15;
export const OUTPUT_COLLAPSE_CHAR_THRESHOLD = 800;

export function estimateOutputSize(
  outputs: JupyterOutput[] | undefined,
  runError?: string
): { lines: number; chars: number; preview: string } {
  const parts: string[] = [];
  if (runError) parts.push(runError);
  for (const output of outputs ?? []) {
    const text = getOutputText(output);
    if (text) parts.push(text);
  }
  const combined = parts.join("\n");
  const lines = combined ? combined.split("\n").length : 0;
  const preview = combined.split("\n")[0]?.trim() ?? "";
  return { lines, chars: combined.length, preview };
}

export function isOutputLong(lines: number, chars: number): boolean {
  return lines > OUTPUT_COLLAPSE_LINE_THRESHOLD || chars > OUTPUT_COLLAPSE_CHAR_THRESHOLD;
}

export function shouldCollapseOutput(
  cell: JupyterCell,
  outputs: JupyterOutput[] | undefined,
  runError?: string
): boolean {
  const meta = getGinoteMetadata(cell);
  if (meta.outputCollapsed === true) return true;
  if (meta.outputCollapsed === false) return false;
  const { lines, chars } = estimateOutputSize(outputs, runError);
  return isOutputLong(lines, chars);
}
