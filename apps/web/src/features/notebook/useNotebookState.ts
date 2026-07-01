import { useCallback, useState } from "react";
import type { JupyterCell, JupyterNotebook } from "@odoginote/shared";
import {
  getGinoteMetadata,
  mergeGinoteMetadata,
  type GinoteCellMetadata,
} from "./notebook-sections";

export type NotebookCellType = JupyterCell["cell_type"];

export function createMarkdownCell(): JupyterCell {
  return { cell_type: "markdown", metadata: {}, source: "" };
}

export function createCodeCell(): JupyterCell {
  return {
    cell_type: "code",
    metadata: {},
    source: "",
    outputs: [],
    execution_count: null,
  };
}

export function createRawCell(): JupyterCell {
  return { cell_type: "raw", metadata: {}, source: "" };
}

export function createCell(type: NotebookCellType): JupyterCell {
  if (type === "markdown") return createMarkdownCell();
  if (type === "code") return createCodeCell();
  return createRawCell();
}

function remapIndexSet(set: Set<number>, index: number, delta: -1 | 0 | 1, swapWith?: number): Set<number> {
  const next = new Set<number>();
  for (const i of set) {
    if (i === index) continue;
    if (swapWith != null && i === swapWith) {
      next.add(index);
      continue;
    }
    if (swapWith != null && i === index) {
      next.add(swapWith);
      continue;
    }
    if (i > index) next.add(i + delta);
    else next.add(i);
  }
  return next;
}

interface Options {
  notebook: JupyterNotebook;
  updateNotebook: (next: JupyterNotebook) => void;
}

export function useNotebookState({ notebook, updateNotebook }: Options) {
  const [selectedCellIndex, setSelectedCellIndex] = useState(0);
  const [editingCells, setEditingCells] = useState<Set<number>>(new Set());
  const [clipboardCell, setClipboardCell] = useState<JupyterCell | null>(null);
  const [lastDeleteAt, setLastDeleteAt] = useState(0);

  const updateCell = useCallback(
    (index: number, patch: Partial<JupyterCell>) => {
      const cells = notebook.cells.map((cell, i) =>
        i === index ? ({ ...cell, ...patch } as JupyterCell) : cell
      );
      updateNotebook({ ...notebook, cells });
    },
    [notebook, updateNotebook]
  );

  const insertCellAt = useCallback(
    (index: number, cell: JupyterCell) => {
      const cells = [...notebook.cells];
      cells.splice(index, 0, cell);
      updateNotebook({ ...notebook, cells });
      setSelectedCellIndex(index);
      setEditingCells((prev) => {
        const next = new Set<number>();
        for (const i of prev) next.add(i >= index ? i + 1 : i);
        if (cell.cell_type === "markdown") next.add(index);
        return next;
      });
    },
    [notebook, updateNotebook]
  );

  const insertAbove = useCallback(
    (type: NotebookCellType = "code") => {
      insertCellAt(selectedCellIndex, createCell(type));
    },
    [insertCellAt, selectedCellIndex]
  );

  const insertBelow = useCallback(
    (type: NotebookCellType = "code") => {
      insertCellAt(selectedCellIndex + 1, createCell(type));
    },
    [insertCellAt, selectedCellIndex]
  );

  const removeCell = useCallback(
    (index: number) => {
      if (notebook.cells.length <= 1) return;
      const cells = notebook.cells.filter((_, i) => i !== index);
      updateNotebook({ ...notebook, cells });
      setEditingCells((prev) => remapIndexSet(prev, index, -1));
      setSelectedCellIndex((prev) => Math.min(prev, Math.max(0, cells.length - 1)));
    },
    [notebook, updateNotebook]
  );

  const tryDeleteSelected = useCallback(() => {
    const now = Date.now();
    if (now - lastDeleteAt < 600) {
      removeCell(selectedCellIndex);
      setLastDeleteAt(0);
    } else {
      setLastDeleteAt(now);
    }
  }, [lastDeleteAt, removeCell, selectedCellIndex]);

  const moveCell = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= notebook.cells.length) return;
      const cells = [...notebook.cells];
      [cells[index], cells[target]] = [cells[target], cells[index]];
      updateNotebook({ ...notebook, cells });
      setEditingCells((prev) => remapIndexSet(prev, index, 0, target));
      setSelectedCellIndex(target);
    },
    [notebook, updateNotebook]
  );

  const changeCellType = useCallback(
    (index: number, type: NotebookCellType) => {
      const cell = notebook.cells[index];
      if (cell.cell_type === type) return;
      const next = createCell(type);
      next.source = cell.source;
      updateCell(index, next);
    },
    [notebook.cells, updateCell]
  );

  const copyCell = useCallback(
    (index: number) => {
      setClipboardCell({ ...notebook.cells[index] });
    },
    [notebook.cells]
  );

  const cutCell = useCallback(
    (index: number) => {
      copyCell(index);
      removeCell(index);
    },
    [copyCell, removeCell]
  );

  const pasteBelow = useCallback(() => {
    if (!clipboardCell) return;
    insertCellAt(selectedCellIndex + 1, { ...clipboardCell });
  }, [clipboardCell, insertCellAt, selectedCellIndex]);

  const startEditing = useCallback((index: number) => {
    setEditingCells((prev) => new Set(prev).add(index));
    setSelectedCellIndex(index);
  }, []);

  const stopEditing = useCallback((index: number) => {
    setEditingCells((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const selectCell = useCallback((index: number) => {
    setSelectedCellIndex(index);
  }, []);

  const selectNextCell = useCallback(() => {
    setSelectedCellIndex((prev) => Math.min(prev + 1, notebook.cells.length - 1));
  }, [notebook.cells.length]);

  const selectPrevCell = useCallback(() => {
    setSelectedCellIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const resetUiState = useCallback(() => {
    setEditingCells(new Set());
    setSelectedCellIndex(0);
  }, []);

  const updateCellMetadata = useCallback(
    (index: number, patch: Partial<GinoteCellMetadata>) => {
      const cell = notebook.cells[index];
      if (!cell) return;
      updateCell(index, { metadata: mergeGinoteMetadata(cell, patch) });
    },
    [notebook.cells, updateCell]
  );

  const toggleSectionCollapse = useCallback(
    (index: number) => {
      const cell = notebook.cells[index];
      if (!cell) return;
      const collapsed = !getGinoteMetadata(cell).sectionCollapsed;
      updateCellMetadata(index, { sectionCollapsed: collapsed });
    },
    [notebook.cells, updateCellMetadata]
  );

  const toggleOutputCollapse = useCallback(
    (index: number, collapsed?: boolean) => {
      const cell = notebook.cells[index];
      if (!cell) return;
      const next =
        collapsed ?? !getGinoteMetadata(cell).outputCollapsed;
      updateCellMetadata(index, { outputCollapsed: next });
    },
    [notebook.cells, updateCellMetadata]
  );

  const setOutputCollapsed = useCallback(
    (index: number, collapsed: boolean) => {
      updateCellMetadata(index, { outputCollapsed: collapsed });
    },
    [updateCellMetadata]
  );

  return {
    selectedCellIndex,
    setSelectedCellIndex: selectCell,
    editingCells,
    clipboardCell,
    updateCell,
    insertAbove,
    insertBelow,
    insertCellAt,
    removeCell,
    tryDeleteSelected,
    moveCell,
    changeCellType,
    copyCell,
    cutCell,
    pasteBelow,
    startEditing,
    stopEditing,
    selectNextCell,
    selectPrevCell,
    resetUiState,
    updateCellMetadata,
    toggleSectionCollapse,
    toggleOutputCollapse,
    setOutputCollapsed,
  };
}
