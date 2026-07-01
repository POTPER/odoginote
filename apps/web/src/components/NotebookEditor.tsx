import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  importNotebookFromFile,
  parseNotebookContent,
  serializeNotebookContent,
  type JupyterNotebook,
} from "@odoginote/shared";
import type { KernelRunner, KernelStatus } from "../lib/kernel-runner";
import { loadJupyterConfig } from "../lib/kernel-runner";
import {
  getJupyterTroubleshootingSteps,
  isProductionRemoteAccess,
} from "../lib/jupyter-connection-diagnostics";
import { createNotebookMarkdownComponents } from "../lib/markdown-components";
import {
  createCodeCell,
  type NotebookCellType,
  useNotebookState,
} from "../features/notebook/useNotebookState";
import { useNotebookShortcuts } from "../features/notebook/useNotebookShortcuts";
import {
  buildHiddenBySection,
  isSectionHeaderCell,
} from "../features/notebook/notebook-sections";
import { shouldAutoCollapseAfterRun } from "./notebook/CollapsibleOutput";
import { ColabCodeCell } from "./notebook/ColabCodeCell";
import { ColabSectionHeader } from "./notebook/ColabSectionHeader";
import { NotebookCellToolbar } from "./notebook/NotebookCellToolbar";

interface Props {
  content: string;
  onChange: (json: string) => void;
  kernelRunner: KernelRunner;
  kernelStatus: KernelStatus;
  kernelDisplayName: string;
  kernelError?: string | null;
  onReconnect?: () => void;
  theme?: "light" | "dark";
}

function AddCellButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="notebook-add-cell" onClick={onClick}>
      点击添加单元
    </button>
  );
}

function KernelConnectionError({ message }: { message: string }) {
  const config = loadJupyterConfig();
  const showSteps = isProductionRemoteAccess(config.baseUrl);
  const steps = getJupyterTroubleshootingSteps(config.baseUrl);

  return (
    <div className="notebook-kernel-error">
      <pre className="notebook-kernel-error-text">{message}</pre>
      {showSteps && (
        <div className="notebook-kernel-error-steps">
          <p className="notebook-kernel-error-steps-title">快速排查：</p>
          <ol>
            {steps.map((step) => (
              <li key={step}>{step.replace(/^\d+\.\s*/, "")}</li>
            ))}
          </ol>
          <p className="notebook-kernel-error-hint">
            完整配置示例见侧边栏「设置 → Jupyter 连接」，复制后写入本机{" "}
            <code>jupyter_server_config.py</code> 并重启 Jupyter。
          </p>
        </div>
      )}
    </div>
  );
}

export default function NotebookEditor({
  content,
  onChange,
  kernelRunner,
  kernelStatus,
  kernelDisplayName,
  kernelError,
  onReconnect,
  theme = "dark",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [runErrors, setRunErrors] = useState<Record<number, string>>({});
  const [runningCell, setRunningCell] = useState<number | null>(null);
  const [runningAll, setRunningAll] = useState(false);

  const notebook = useMemo(() => parseNotebookContent(content), [content]);

  const updateNotebook = useCallback(
    (next: JupyterNotebook) => onChange(serializeNotebookContent(next)),
    [onChange]
  );

  const nb = useNotebookState({ notebook, updateNotebook });

  const hiddenBySection = useMemo(
    () => buildHiddenBySection(notebook.cells),
    [notebook.cells]
  );

  const clearCellOutput = useCallback(
    (index: number) => {
      nb.updateCell(index, { outputs: [] });
      nb.setOutputCollapsed(index, false);
      setRunErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    },
    [nb]
  );

  const runCellAt = useCallback(
    async (index: number, advance = false) => {
      const cell = notebook.cells[index];
      if (cell.cell_type === "markdown") {
        nb.stopEditing(index);
        if (advance) nb.selectNextCell();
        return;
      }
      if (cell.cell_type !== "code") {
        if (advance) nb.selectNextCell();
        return;
      }

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
          if (shouldAutoCollapseAfterRun(cell, undefined, result.error)) {
            nb.setOutputCollapsed(index, true);
          }
          return;
        }
        const execution_count =
          typeof cell.execution_count === "number" ? cell.execution_count + 1 : 1;
        nb.updateCell(index, {
          outputs: result.outputs,
          execution_count,
        });
        if (shouldAutoCollapseAfterRun(cell, result.outputs)) {
          nb.setOutputCollapsed(index, true);
        }
      } finally {
        setRunningCell(null);
        if (advance) nb.selectNextCell();
      }
    },
    [kernelRunner, nb, notebook.cells]
  );

  const runSelectedCell = useCallback(
    (advance = true) => {
      void runCellAt(nb.selectedCellIndex, advance);
    },
    [nb.selectedCellIndex, runCellAt]
  );

  const runAllCells = useCallback(async () => {
    setRunningAll(true);
    try {
      for (let i = 0; i < notebook.cells.length; i++) {
        if (notebook.cells[i].cell_type === "code") {
          nb.setSelectedCellIndex(i);
          await runCellAt(i, false);
        }
      }
    } finally {
      setRunningAll(false);
    }
  }, [notebook.cells, nb, runCellAt]);

  useNotebookShortcuts(containerRef, true, {
    onInsertAbove: () => nb.insertAbove("code"),
    onInsertBelow: () => nb.insertBelow("code"),
    onDeleteSelected: nb.tryDeleteSelected,
    onRunSelected: () => runSelectedCell(true),
    onMoveSelectionUp: nb.selectPrevCell,
    onMoveSelectionDown: nb.selectNextCell,
  });

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
        updateNotebook(importNotebookFromFile(json));
        nb.resetUiState();
      } catch (err) {
        alert(err instanceof Error ? err.message : "导入失败");
      }
    };
    reader.readAsText(file);
  }

  function handleMarkdownKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, index: number) {
    if (e.key === "Escape") {
      e.preventDefault();
      nb.stopEditing(index);
    }
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      void runCellAt(index, true);
    }
  }

  function handleCodeKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, index: number) {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      void runCellAt(index, true);
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void runCellAt(index, false);
    }
  }

  const statusLabel =
    kernelStatus === "ready"
      ? kernelDisplayName
      : kernelStatus === "connecting"
        ? "连接中…"
        : "未连接";

  return (
    <div className="notebook-editor" ref={containerRef} tabIndex={-1}>
      <div className="notebook-toolbar">
        <div className="notebook-toolbar-group">
          <button type="button" title="在下方插入单元 (B)" onClick={() => nb.insertBelow("code")}>
            +
          </button>
          <button
            type="button"
            title="运行选中单元 (Shift+Enter)"
            disabled={runningCell != null || runningAll}
            onClick={() => runSelectedCell(false)}
          >
            ▶
          </button>
          <button
            type="button"
            title="运行全部"
            disabled={runningCell != null || runningAll}
            onClick={() => void runAllCells()}
          >
            ⏩
          </button>
          <button
            type="button"
            title="中断内核"
            disabled={kernelStatus !== "ready"}
            onClick={() => void kernelRunner.interrupt?.()}
          >
            ⏹
          </button>
          <button
            type="button"
            title="重启内核"
            disabled={kernelStatus !== "ready"}
            onClick={() => void kernelRunner.restart?.()}
          >
            ↻
          </button>
          <select
            className="notebook-cell-type-select"
            value={notebook.cells[nb.selectedCellIndex]?.cell_type ?? "code"}
            onChange={(e) =>
              nb.changeCellType(nb.selectedCellIndex, e.target.value as NotebookCellType)
            }
            title="单元类型"
          >
            <option value="code">Code</option>
            <option value="markdown">Markdown</option>
            <option value="raw">Raw</option>
          </select>
          <button type="button" onClick={() => nb.insertBelow("markdown")}>
            + Md
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            导入
          </button>
        </div>
        <div className="notebook-toolbar-group notebook-toolbar-right">
          <span className={`notebook-kernel-badge status-${kernelStatus}`} title={kernelError ?? ""}>
            {statusLabel}
          </span>
          {kernelStatus !== "ready" && onReconnect && (
            <button type="button" className="notebook-reconnect-btn" onClick={() => void onReconnect()}>
              重连
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ipynb,application/json"
          hidden
          onChange={handleImportFile}
        />
      </div>

      {kernelError && kernelStatus !== "ready" && (
        <KernelConnectionError message={kernelError} />
      )}

      <div className="notebook-cells">
        {notebook.cells.map((cell, index) => {
          if (hiddenBySection.has(index)) return null;

          const isSelected = nb.selectedCellIndex === index;
          const isEditing = nb.editingCells.has(index);
          const isRunning = runningCell === index;
          const isSectionHeader = isSectionHeaderCell(cell);

          if (isSectionHeader) {
            return (
              <div key={index}>
                <ColabSectionHeader
                  cell={cell}
                  index={index}
                  isSelected={isSelected}
                  isEditing={isEditing}
                  totalCells={notebook.cells.length}
                  markdownComponents={notebookMarkdownComponents}
                  onSelect={() => nb.setSelectedCellIndex(index)}
                  onToggleCollapse={() => nb.toggleSectionCollapse(index)}
                  onStartEdit={() => nb.startEditing(index)}
                  onStopEdit={() => nb.stopEditing(index)}
                  onUpdateSource={(source) => nb.updateCell(index, { source })}
                  onMoveUp={() => nb.moveCell(index, -1)}
                  onMoveDown={() => nb.moveCell(index, 1)}
                  onDelete={() => nb.removeCell(index)}
                  onKeyDown={(e) => handleMarkdownKeyDown(e, index)}
                />
                <AddCellButton onClick={() => nb.insertCellAt(index + 1, createCodeCell())} />
              </div>
            );
          }

          if (cell.cell_type === "code") {
            return (
              <div key={index}>
                <ColabCodeCell
                  cell={cell}
                  index={index}
                  isSelected={isSelected}
                  isRunning={isRunning}
                  totalCells={notebook.cells.length}
                  runError={runErrors[index]}
                  onSelect={() => nb.setSelectedCellIndex(index)}
                  onRun={() => void runCellAt(index, false)}
                  onUpdateSource={(source) => nb.updateCell(index, { source })}
                  onKeyDown={(e) => handleCodeKeyDown(e, index)}
                  onMoveUp={() => nb.moveCell(index, -1)}
                  onMoveDown={() => nb.moveCell(index, 1)}
                  onDelete={() => nb.removeCell(index)}
                  onToggleOutputCollapse={(collapsed) => nb.setOutputCollapsed(index, collapsed)}
                  onClearOutput={() => clearCellOutput(index)}
                />
                <AddCellButton onClick={() => nb.insertCellAt(index + 1, createCodeCell())} />
              </div>
            );
          }

          return (
            <div key={index}>
              <div
                className={`notebook-cell notebook-cell-${cell.cell_type}${isSelected ? " notebook-cell-selected" : ""}`}
                onClick={() => nb.setSelectedCellIndex(index)}
              >
                <div className="notebook-cell-body">
                  <NotebookCellToolbar
                    visible={isSelected}
                    canMoveUp={index > 0}
                    canMoveDown={index < notebook.cells.length - 1}
                    canDelete={notebook.cells.length > 1}
                    showEdit={cell.cell_type === "markdown"}
                    isEditing={isEditing}
                    onEdit={() => nb.startEditing(index)}
                    onFinishEdit={() => nb.stopEditing(index)}
                    onMoveUp={() => nb.moveCell(index, -1)}
                    onMoveDown={() => nb.moveCell(index, 1)}
                    onDelete={() => nb.removeCell(index)}
                  />

                  {cell.cell_type === "markdown" && isEditing && (
                    <textarea
                      className="notebook-cell-input"
                      value={cell.source}
                      onChange={(e) => nb.updateCell(index, { source: e.target.value })}
                      onKeyDown={(e) => handleMarkdownKeyDown(e, index)}
                      placeholder="Markdown..."
                      rows={4}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}

                  {cell.cell_type === "markdown" && !isEditing && (
                    <div
                      className="notebook-markdown-preview markdown-preview"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        nb.startEditing(index);
                      }}
                      title="双击编辑"
                    >
                      <div className="readable-inner">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={notebookMarkdownComponents}>
                          {cell.source || "*空 Markdown 单元*"}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {cell.cell_type === "raw" && (
                    <textarea
                      className="notebook-cell-input notebook-raw-input"
                      value={cell.source}
                      onChange={(e) => nb.updateCell(index, { source: e.target.value })}
                      rows={3}
                      spellCheck={false}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              </div>
              <AddCellButton onClick={() => nb.insertCellAt(index + 1, createCodeCell())} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
