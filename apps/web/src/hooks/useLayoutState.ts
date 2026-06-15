import { useCallback, useState } from "react";

export type RightPanelTab = "outline" | "backlinks" | "outgoing";

export interface LayoutState {
  sidebarWidth: number;
  rightWidth: number;
  sidebarCollapsed: boolean;
  rightCollapsed: boolean;
  rightPanel: RightPanelTab;
}

const STORAGE_KEY = "ginote.layout";
const DEFAULT: LayoutState = {
  sidebarWidth: 260,
  rightWidth: 200,
  sidebarCollapsed: false,
  rightCollapsed: false,
  rightPanel: "outline",
};

function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function useLayoutState() {
  const [layout, setLayout] = useState<LayoutState>(loadLayout);

  const updateLayout = useCallback((patch: Partial<LayoutState>) => {
    setLayout((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { layout, updateLayout };
}
