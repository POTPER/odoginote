export interface ExcalidrawScene {
  type: "excalidraw";
  version: number;
  source: string;
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

export function createEmptyExcalidrawScene(): ExcalidrawScene {
  return {
    type: "excalidraw",
    version: 2,
    source: "odoginote",
    elements: [],
    appState: {
      viewBackgroundColor: "#ffffff",
    },
    files: {},
  };
}

export function parseExcalidrawContent(raw: string): ExcalidrawScene {
  const trimmed = raw.trim();
  if (!trimmed) return createEmptyExcalidrawScene();
  try {
    const parsed = JSON.parse(trimmed) as Partial<ExcalidrawScene>;
    if (parsed.type === "excalidraw" && Array.isArray(parsed.elements)) {
      const appState = { ...(parsed.appState ?? { viewBackgroundColor: "#ffffff" }) };
      delete appState.collaborators;
      return {
        type: "excalidraw",
        version: parsed.version ?? 2,
        source: parsed.source ?? "odoginote",
        elements: parsed.elements,
        appState,
        files: parsed.files ?? {},
      };
    }
  } catch {
    /* invalid JSON */
  }
  return createEmptyExcalidrawScene();
}

export function serializeExcalidrawContent(scene: ExcalidrawScene): string {
  return JSON.stringify(scene);
}

export function countExcalidrawElements(content: string): number {
  return parseExcalidrawContent(content).elements.length;
}
