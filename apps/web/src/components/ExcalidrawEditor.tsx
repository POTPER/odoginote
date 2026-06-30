import { lazy, Suspense, useCallback, useMemo, useRef } from "react";
import {
  parseExcalidrawContent,
  serializeExcalidrawContent,
  type ExcalidrawScene,
} from "@odoginote/shared";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import { restore, serializeAsJSON } from "@excalidraw/excalidraw";

import "@excalidraw/excalidraw/index.css";

const Excalidraw = lazy(() =>
  import("@excalidraw/excalidraw").then((mod) => ({ default: mod.Excalidraw }))
);

interface Props {
  noteNumber: number;
  content: string;
  theme: "light" | "dark";
  onChange: (json: string) => void;
}

function toInitialData(content: string): ExcalidrawInitialDataState {
  const scene = parseExcalidrawContent(content);
  return restore(
    {
      elements: scene.elements as ExcalidrawInitialDataState["elements"],
      appState: scene.appState as ExcalidrawInitialDataState["appState"],
      files: scene.files as ExcalidrawInitialDataState["files"],
    },
    null,
    null
  );
}

function ExcalidrawCanvas({ noteNumber, content, theme, onChange }: Props) {
  const noteKeyRef = useRef(noteNumber);
  const initialData = useMemo(() => {
    if (noteKeyRef.current !== noteNumber) {
      noteKeyRef.current = noteNumber;
    }
    return toInitialData(content);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount per note only
  }, [noteNumber]);

  const handleChange = useCallback<
    NonNullable<React.ComponentProps<typeof Excalidraw>["onChange"]>
  >(
    (elements, appState, files) => {
      const stored = JSON.parse(
        serializeAsJSON(elements, appState, files, "database")
      ) as {
        elements?: unknown[];
        appState?: Record<string, unknown>;
        files?: Record<string, unknown>;
      };
      const scene: ExcalidrawScene = {
        type: "excalidraw",
        version: 2,
        source: "odoginote",
        elements: stored.elements ?? [...elements],
        appState: stored.appState ?? {},
        files: stored.files ?? (files as unknown as Record<string, unknown>),
      };
      onChange(serializeExcalidrawContent(scene));
    },
    [onChange]
  );

  return (
    <div className="excalidraw-editor">
      <Excalidraw
        key={noteNumber}
        theme={theme}
        initialData={initialData}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
          },
        }}
      />
    </div>
  );
}

export default function ExcalidrawEditor(props: Props) {
  return (
    <Suspense fallback={<div className="excalidraw-loading">加载画布...</div>}>
      <ExcalidrawCanvas {...props} />
    </Suspense>
  );
}
