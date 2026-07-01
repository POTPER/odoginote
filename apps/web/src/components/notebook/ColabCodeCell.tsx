import type { KeyboardEvent } from "react";
import type { JupyterCell } from "@odoginote/shared";
import { NotebookCellToolbar } from "./NotebookCellToolbar";
import { CollapsibleOutput } from "./CollapsibleOutput";
import { IconPlay } from "./notebook-icons";

interface Props {
  cell: JupyterCell;
  index: number;
  isSelected: boolean;
  isRunning: boolean;
  totalCells: number;
  runError?: string;
  onSelect: () => void;
  onRun: () => void;
  onUpdateSource: (source: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onToggleOutputCollapse: (collapsed: boolean) => void;
  onClearOutput: () => void;
}

export function ColabCodeCell({
  cell,
  index,
  isSelected,
  isRunning,
  totalCells,
  runError,
  onSelect,
  onRun,
  onUpdateSource,
  onKeyDown,
  onMoveUp,
  onMoveDown,
  onDelete,
  onToggleOutputCollapse,
  onClearOutput,
}: Props) {
  const hasRunError = Boolean(runError);
  const hasOutputs = (cell.outputs?.length ?? 0) > 0;
  const hasOutput = hasRunError || hasOutputs;
  const execLabel =
    isRunning ? "[*]" : cell.execution_count != null ? `[${cell.execution_count}]` : "";

  return (
    <div
      className={`notebook-cell notebook-cell-code notebook-colab-code${isSelected ? " notebook-cell-selected" : ""}`}
      onClick={onSelect}
    >
      <div className="notebook-cell-body">
        <NotebookCellToolbar
          visible={isSelected}
          canMoveUp={index > 0}
          canMoveDown={index < totalCells - 1}
          canDelete={totalCells > 1}
          showClear={hasOutput}
          onClear={onClearOutput}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={onDelete}
        />
        <div className="notebook-colab-code-row">
          <div className="notebook-colab-play-col">
            <button
              type="button"
              className={`notebook-colab-play${isRunning ? " is-running" : ""}`}
              title={isRunning ? "运行中…" : `运行 (In ${execLabel || "[ ]"})`}
              disabled={isRunning}
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
            >
              {isRunning ? <span className="notebook-colab-play-spinner">…</span> : <IconPlay />}
            </button>
            {execLabel && !isRunning && (
              <span className="notebook-colab-exec-count">{execLabel}</span>
            )}
          </div>
          <div className="notebook-colab-code-main">
            <textarea
              className="notebook-cell-input notebook-code-input"
              value={cell.source}
              onChange={(e) => onUpdateSource(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="# Python code"
              rows={5}
              spellCheck={false}
              onClick={(e) => e.stopPropagation()}
            />
            <CollapsibleOutput
              cell={cell}
              runError={runError}
              executionCount={cell.execution_count}
              onToggleCollapse={onToggleOutputCollapse}
              onClear={onClearOutput}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
