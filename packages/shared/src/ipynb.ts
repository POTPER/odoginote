export interface JupyterOutput {
  output_type: string;
  name?: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  traceback?: string[];
  ename?: string;
  evalue?: string;
}

export interface JupyterCell {
  cell_type: "markdown" | "code" | "raw";
  metadata: Record<string, unknown>;
  source: string;
  outputs?: JupyterOutput[];
  execution_count?: number | null;
}

export interface JupyterNotebook {
  nbformat: number;
  nbformat_minor: number;
  metadata: Record<string, unknown>;
  cells: JupyterCell[];
}

function normalizeSource(source: unknown): string {
  if (typeof source === "string") return source;
  if (Array.isArray(source)) return source.join("");
  return "";
}

function normalizeCell(cell: Partial<JupyterCell> & { cell_type?: string }): JupyterCell | null {
  if (cell.cell_type !== "markdown" && cell.cell_type !== "code" && cell.cell_type !== "raw") {
    return null;
  }
  return {
    cell_type: cell.cell_type,
    metadata: cell.metadata ?? {},
    source: normalizeSource(cell.source),
    outputs: cell.cell_type === "code" ? (cell.outputs ?? []) : undefined,
    execution_count: cell.cell_type === "code" ? (cell.execution_count ?? null) : undefined,
  };
}

export function createEmptyNotebook(): JupyterNotebook {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {},
    cells: [
      {
        cell_type: "markdown",
        metadata: {},
        source: "# Notebook\n\n在此编辑 Markdown 与 Code 单元格。",
      },
      {
        cell_type: "code",
        metadata: {},
        source: "",
        outputs: [],
        execution_count: null,
      },
    ],
  };
}

export function parseNotebookContent(raw: string): JupyterNotebook {
  const trimmed = raw.trim();
  if (!trimmed) return createEmptyNotebook();
  try {
    const parsed = JSON.parse(trimmed) as Partial<JupyterNotebook>;
    if (parsed.nbformat !== 4 || !Array.isArray(parsed.cells)) {
      return createEmptyNotebook();
    }
    const cells = parsed.cells
      .map((c) => normalizeCell(c as Partial<JupyterCell> & { cell_type?: string }))
      .filter((c): c is JupyterCell => c != null);
    return {
      nbformat: 4,
      nbformat_minor: parsed.nbformat_minor ?? 5,
      metadata: parsed.metadata ?? {},
      cells: cells.length > 0 ? cells : createEmptyNotebook().cells,
    };
  } catch {
    return createEmptyNotebook();
  }
}

export function serializeNotebookContent(notebook: JupyterNotebook): string {
  return JSON.stringify(notebook);
}

export function countNotebookCells(content: string): number {
  return parseNotebookContent(content).cells.length;
}

export function importNotebookFromFile(json: unknown): JupyterNotebook {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid notebook JSON");
  }
  const parsed = json as Partial<JupyterNotebook>;
  if (parsed.nbformat !== 4 || !Array.isArray(parsed.cells)) {
    throw new Error("Only nbformat v4 notebooks are supported");
  }
  const cells = parsed.cells
    .map((c) => normalizeCell(c as Partial<JupyterCell> & { cell_type?: string }))
    .filter((c): c is JupyterCell => c != null);
  if (cells.length === 0) {
    throw new Error("Notebook has no valid cells");
  }
  return {
    nbformat: 4,
    nbformat_minor: parsed.nbformat_minor ?? 5,
    metadata: parsed.metadata ?? {},
    cells,
  };
}

export function getOutputText(output: JupyterOutput): string {
  if (output.output_type === "stream" || output.output_type === "execute_result") {
    const text = output.text ?? output.data?.["text/plain"];
    if (typeof text === "string") return text;
    if (Array.isArray(text)) return text.join("");
  }
  if (output.output_type === "error") {
    const trace = output.traceback?.join("\n");
    if (trace) return trace;
    if (output.ename || output.evalue) {
      return `${output.ename ?? "Error"}: ${output.evalue ?? ""}`;
    }
  }
  return "";
}
