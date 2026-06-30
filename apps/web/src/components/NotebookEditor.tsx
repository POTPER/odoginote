import { useCallback, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getOutputText,
  importNotebookFromFile,
  parseNotebookContent,
  serializeNotebookContent,
  type JupyterCell,
  type JupyterNotebook,
  type JupyterOutput,
} from "@odoginote/shared";
import type { KernelRunner } from "../lib/kernel-runner";
import { createNotebookMarkdownComponents } from "../lib/markdown-components";

interface Props {
  content: string;
  onChange: (json: string) => void;
  kernelRunner: KernelRunner;
  theme?: "light" | "dark";
}

function createMarkdownCell(): JupyterCell {
  return { cell_type: "markdown", metadata: {}, source: "" };
}

function createCodeCell(): JupyterCell {
  return {
    cell_type: "code",
    metadata: {},
    source: "",
    outputs: [],
    execution_count: null,
  };
}

function OutputBlock({ output }: { output: JupyterOutput }) {
  if (output.output_type === "display_data" || output.output_type === "execute_result") {
    const png = output.data?.["image/png"];
    if (typeof png === "string") {
      return (
        <img
          className="notebook-output-image"
          src={`data:image/png;base64,${png}`}
          alt="output"
        />
      );
    }
  }
  const text = getOutputText(output);
  if (!text) return null;
  return (
    <pre className={`notebook-output notebook-output-${output.output_type}`}>{text}</pre>
  );
}

export default function NotebookEditor({ content, onChange, kernelRunner, theme = "dark" }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [runErrors, setRunErrors] = useState<Record<number, string>>({});
  const [runningCell, setRunningCell] = useState<number | null>(null);

  const notebook = useMemo(() => parseNotebookContent(content), [content]);

  const updateNotebook = useCallback(
    (next: JupyterNotebook) => {
      onChange(serializeNotebookContent(next));
    },
    [onChange]
  );

  const updateCell = useCallback(
    (index: number, patch: Partial<JupyterCell>) => {
      const cells = notebook.cells.map((cell, i) =>
        i === index ? { ...cell, ...patch } : cell
      );
      updateNotebook({ ...notebook, cells });
    },
    [notebook, updateNotebook]
  );

  const insertCell = useCallback(
    (index: number, cell: JupyterCell) => {
      const cells = [...notebook.cells];
      cells.splice(index, 0, cell);
      updateNotebook({ ...notebook, cells });
    },
    [notebook, updateNotebook]
  );

  const removeCell = useCallback(
    (index: number) => {
      if (notebook.cells.length <= 1) return;
      const cells = notebook.cells.filter((_, i) => i !== index);
      updateNotebook({ ...notebook, cells });
    },
    [notebook, updateNotebook]
  );

  const moveCell = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= notebook.cells.length) return;
      const cells = [...notebook.cells];
      [cells[index], cells[target]] = [cells[target], cells[index]];
      updateNotebook({ ...notebook, cells });
    },
    [notebook, updateNotebook]
  );

  async function runCell(index: number) {
    const cell = notebook.cells[index];
    if (cell.cell_type !== "code") return;
    setRunningCell(index);
    setRunErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    try {
      const result = await kernelRunner.runCell(cell.source);
      if (result.error) {
        setRunErrors((prev) => ({ ...prev, [index]: result.error! }));
        return;
      }
      updateCell(index, {
        outputs: result.outputs,
        execution_count:
          typeof cell.execution_count === "number" ? cell.execution_count + 1 : 1,
      });
    } finally {
      setRunningCell(null);
    }
  }

  const notebookMarkdownComponents = useMemo(
    () => createNotebookMarkdownComponents(theme),
    [theme]
  );

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        const imported = importNotebookFromFile(json);
        updateNotebook(imported);
      } catch (err) {
        alert(err instanceof Error ? err.message : "导入失败");
      }
    };
    reader.readAsText(file);
  }

  function togglePreview(index: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="notebook-editor">
      <div className="notebook-toolbar">
        <button type="button" onClick={() => insertCell(notebook.cells.length, createMarkdownCell())}>
          + Markdown
        </button>
        <button type="button" onClick={() => insertCell(notebook.cells.length, createCodeCell())}>
          + Code
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          导入 .ipynb
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ipynb,application/json"
          hidden
          onChange={handleImportFile}
        />
      </div>

      <div className="notebook-cells">
        {notebook.cells.map((cell, index) => (
          <div key={index} className={`notebook-cell notebook-cell-${cell.cell_type}`}>
            <div className="notebook-cell-header">
              <span className="notebook-cell-type">
                {cell.cell_type === "markdown" ? "Markdown" : cell.cell_type === "code" ? "Code" : "Raw"}
              </span>
              <div className="notebook-cell-actions">
                {cell.cell_type === "markdown" && (
                  <button type="button" title="切换预览" onClick={() => togglePreview(index)}>
                    {collapsed.has(index) ? "编辑" : "预览"}
                  </button>
                )}
                {cell.cell_type === "code" && (
                  <button
                    type="button"
                    disabled={runningCell === index}
                    onClick={() => void runCell(index)}
                  >
                    {runningCell === index ? "运行中…" : "运行"}
                  </button>
                )}
                <button type="button" title="上移" disabled={index === 0} onClick={() => moveCell(index, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  title="下移"
                  disabled={index === notebook.cells.length - 1}
                  onClick={() => moveCell(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  title="删除"
                  disabled={notebook.cells.length <= 1}
                  onClick={() => removeCell(index)}
                >
                  删除
                </button>
              </div>
            </div>

            {cell.cell_type === "markdown" && !collapsed.has(index) && (
              <textarea
                className="notebook-cell-input"
                value={cell.source}
                onChange={(e) => updateCell(index, { source: e.target.value })}
                placeholder="Markdown..."
                rows={4}
              />
            )}

            {cell.cell_type === "markdown" && collapsed.has(index) && (
              <div className="notebook-markdown-preview markdown-preview">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={notebookMarkdownComponents}>
                  {cell.source || "*空 Markdown 单元*"}
                </ReactMarkdown>
              </div>
            )}

            {cell.cell_type === "code" && (
              <>
                <textarea
                  className="notebook-cell-input notebook-code-input"
                  value={cell.source}
                  onChange={(e) => updateCell(index, { source: e.target.value })}
                  placeholder="# Python code"
                  rows={5}
                  spellCheck={false}
                />
                {runErrors[index] && (
                  <pre className="notebook-run-error">{runErrors[index]}</pre>
                )}
                {(cell.outputs?.length ?? 0) > 0 && (
                  <div className="notebook-outputs">
                    {cell.outputs!.map((output, oi) => (
                      <OutputBlock key={oi} output={output} />
                    ))}
                  </div>
                )}
              </>
            )}

            {cell.cell_type === "raw" && (
              <textarea
                className="notebook-cell-input"
                value={cell.source}
                onChange={(e) => updateCell(index, { source: e.target.value })}
                rows={3}
                spellCheck={false}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
