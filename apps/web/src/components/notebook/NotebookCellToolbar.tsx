import { IconCheck, IconClear, IconDown, IconEdit, IconTrash, IconUp } from "./notebook-icons";

interface Props {
  visible: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  showEdit?: boolean;
  isEditing?: boolean;
  showClear?: boolean;
  onEdit?: () => void;
  onFinishEdit?: () => void;
  onClear?: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function NotebookCellToolbar({
  visible,
  canMoveUp,
  canMoveDown,
  canDelete,
  showEdit,
  isEditing,
  showClear,
  onEdit,
  onFinishEdit,
  onClear,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) {
  return (
    <div className={`notebook-cell-toolbar${visible ? " visible" : ""}`}>
      {showEdit &&
        (isEditing ? (
          <button type="button" className="notebook-cell-toolbar-icon" title="完成" onClick={onFinishEdit}>
            <IconCheck />
          </button>
        ) : (
          <button type="button" className="notebook-cell-toolbar-icon" title="编辑" onClick={onEdit}>
            <IconEdit />
          </button>
        ))}
      {showClear && (
        <button type="button" className="notebook-cell-toolbar-icon" title="清除输出" onClick={onClear}>
          <IconClear />
        </button>
      )}
      <button
        type="button"
        className="notebook-cell-toolbar-icon"
        title="上移"
        disabled={!canMoveUp}
        onClick={onMoveUp}
      >
        <IconUp />
      </button>
      <button
        type="button"
        className="notebook-cell-toolbar-icon"
        title="下移"
        disabled={!canMoveDown}
        onClick={onMoveDown}
      >
        <IconDown />
      </button>
      <button
        type="button"
        className="notebook-cell-toolbar-icon"
        title="删除"
        disabled={!canDelete}
        onClick={onDelete}
      >
        <IconTrash />
      </button>
    </div>
  );
}
