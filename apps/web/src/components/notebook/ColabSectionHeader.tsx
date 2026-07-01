import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { getGinoteMetadata, parseSectionHeader } from "../../features/notebook/notebook-sections";
import type { JupyterCell } from "@odoginote/shared";
import { NotebookCellToolbar } from "./NotebookCellToolbar";
import { IconChevron } from "./notebook-icons";

interface Props {
  cell: JupyterCell;
  index: number;
  isSelected: boolean;
  isEditing: boolean;
  totalCells: number;
  markdownComponents: Components;
  onSelect: () => void;
  onToggleCollapse: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onUpdateSource: (source: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function ColabSectionHeader({
  cell,
  index,
  isSelected,
  isEditing,
  totalCells,
  markdownComponents,
  onSelect,
  onToggleCollapse,
  onStartEdit,
  onStopEdit,
  onUpdateSource,
  onMoveUp,
  onMoveDown,
  onDelete,
  onKeyDown,
}: Props) {
  const { title, description } = parseSectionHeader(cell.source);
  const collapsed = getGinoteMetadata(cell).sectionCollapsed;

  return (
    <div
      className={`notebook-cell notebook-colab-section${isSelected ? " notebook-cell-selected" : ""}`}
      onClick={onSelect}
    >
      <div className="notebook-colab-section-header">
        <button
          type="button"
          className="notebook-colab-chevron"
          title={collapsed ? "展开章节" : "折叠章节"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
        >
          <IconChevron expanded={!collapsed} />
        </button>
        <div className="notebook-colab-section-main">
          {isEditing ? (
            <textarea
              className="notebook-cell-input notebook-colab-section-edit"
              value={cell.source}
              onChange={(e) => onUpdateSource(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="# Section title"
              rows={4}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <h2 className="notebook-colab-section-title">{title || "Untitled section"}</h2>
              {description && (
                <div className="notebook-colab-section-desc markdown-preview">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {description}
                  </ReactMarkdown>
                </div>
              )}
            </>
          )}
        </div>
        <NotebookCellToolbar
          visible={isSelected}
          canMoveUp={index > 0}
          canMoveDown={index < totalCells - 1}
          canDelete={totalCells > 1}
          showEdit
          isEditing={isEditing}
          onEdit={onStartEdit}
          onFinishEdit={onStopEdit}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
