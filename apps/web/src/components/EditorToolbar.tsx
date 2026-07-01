interface Props {
  onFormat: (before: string, after?: string) => void;
  onInsertLink: () => void;
  onToggleHeading: () => void;
  disabled?: boolean;
}

export default function EditorToolbar({
  onFormat,
  onInsertLink,
  onToggleHeading,
  disabled,
}: Props) {
  return (
    <div className="editor-toolbar">
      <button type="button" title="粗体 (Ctrl+B)" disabled={disabled} onClick={() => onFormat("**")}>
        <strong>B</strong>
      </button>
      <button type="button" title="斜体 (Ctrl+I)" disabled={disabled} onClick={() => onFormat("*")}>
        <em>I</em>
      </button>
      <button type="button" title="行内代码 (Ctrl+`)" disabled={disabled} onClick={() => onFormat("`")}>
        {"</>"}
      </button>
      <span className="editor-toolbar-sep" />
      <button type="button" title="标题升降级 (Ctrl+H)" disabled={disabled} onClick={onToggleHeading}>
        H
      </button>
      <button type="button" title="Wiki 链接" disabled={disabled} onClick={onInsertLink}>
        [[
      </button>
    </div>
  );
}
