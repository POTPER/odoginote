import {
  getOutputMimeData,
  getOutputText,
  type JupyterOutput,
} from "@odoginote/shared";
import {
  estimateOutputSize,
  getGinoteMetadata,
  isOutputLong,
  shouldCollapseOutput,
} from "../../features/notebook/notebook-sections";
import type { JupyterCell } from "@odoginote/shared";

function OutputBlock({ output }: { output: JupyterOutput }) {
  if (output.output_type === "stream") {
    const text = getOutputText(output);
    if (!text) return null;
    const isStderr = output.name === "stderr";
    return (
      <div className={`notebook-output-row ${isStderr ? "is-stderr" : "is-stdout"}`}>
        <span className="notebook-output-label">{isStderr ? "stderr" : "stdout"}</span>
        <pre
          className={`notebook-output ${isStderr ? "notebook-output-stderr" : "notebook-output-stdout"}`}
        >
          {text}
        </pre>
      </div>
    );
  }

  if (output.output_type === "error") {
    const text = getOutputText(output);
    if (!text) return null;
    return (
      <div className="notebook-output-row is-error">
        <span className="notebook-output-label">error</span>
        <pre className="notebook-output notebook-output-error">{text}</pre>
      </div>
    );
  }

  if (output.output_type === "display_data" || output.output_type === "execute_result") {
    const html = getOutputMimeData(output, "text/html");
    if (html) {
      return <iframe className="notebook-output-html" sandbox="" title="cell output" srcDoc={html} />;
    }
    const png = getOutputMimeData(output, "image/png");
    if (png) {
      return <img className="notebook-output-image" src={`data:image/png;base64,${png}`} alt="output" />;
    }
    const jpeg = getOutputMimeData(output, "image/jpeg");
    if (jpeg) {
      return <img className="notebook-output-image" src={`data:image/jpeg;base64,${jpeg}`} alt="output" />;
    }
    const svg = getOutputMimeData(output, "image/svg+xml");
    if (svg) {
      return (
        <img
          className="notebook-output-image"
          src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
          alt="output"
        />
      );
    }
  }

  const text = getOutputText(output);
  if (!text) return null;
  return <pre className="notebook-output notebook-output-stdout">{text}</pre>;
}

interface Props {
  cell: JupyterCell;
  runError?: string;
  executionCount: number | null | undefined;
  onToggleCollapse: (collapsed: boolean) => void;
  onClear: () => void;
}

export function CollapsibleOutput({
  cell,
  runError,
  executionCount,
  onToggleCollapse,
  onClear,
}: Props) {
  const outputs = cell.outputs;
  const hasOutputs = (outputs?.length ?? 0) > 0;
  const hasOutput = Boolean(runError || hasOutputs);
  if (!hasOutput) return null;

  const { lines, chars, preview } = estimateOutputSize(outputs, runError);
  const isLong = isOutputLong(lines, chars);
  const collapsed = shouldCollapseOutput(cell, outputs, runError);
  const outLabel = executionCount != null ? executionCount : " ";

  if (collapsed && isLong) {
    return (
      <div className="notebook-colab-output-collapsed">
        <button
          type="button"
          className="notebook-colab-output-toggle"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(false);
          }}
        >
          <span className="notebook-colab-output-toggle-icon">⋯</span>
          显示隐藏输出
          {preview && <span className="notebook-colab-output-preview"> — {preview}</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="notebook-output-block notebook-colab-output">
      <div className="notebook-colab-output-header">
        <span className="notebook-colab-output-label">Out [{outLabel}]</span>
        <div className="notebook-colab-output-actions">
          {isLong && (
            <button
              type="button"
              className="notebook-colab-output-action"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(true);
              }}
            >
              隐藏输出
            </button>
          )}
          <button
            type="button"
            className="notebook-colab-output-action"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            清除
          </button>
        </div>
      </div>
      <div className="notebook-output-content">
        {runError && (
          <div className="notebook-output-row is-error">
            <span className="notebook-output-label">kernel</span>
            <pre className="notebook-output notebook-run-error">{runError}</pre>
          </div>
        )}
        {hasOutputs && (
          <div className="notebook-outputs">
            {outputs!.map((output, oi) => (
              <OutputBlock key={oi} output={output} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function shouldAutoCollapseAfterRun(
  cell: JupyterCell,
  outputs: JupyterOutput[] | undefined,
  runError?: string
): boolean {
  const meta = getGinoteMetadata(cell);
  if (meta.outputCollapsed === false) return false;
  const { lines, chars } = estimateOutputSize(outputs, runError);
  return isOutputLong(lines, chars);
}
