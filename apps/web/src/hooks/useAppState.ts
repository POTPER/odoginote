import { useCallback, useEffect, useState } from "react";
import type { ImageStorage } from "@odoginote/shared";
import type { EditorMode, ThemeMode } from "../types/ui";

export type UiStyle = "beautiful" | "compact";

export interface AppSettings {
  editorMode: EditorMode;
  showArchived: boolean;
  theme: ThemeMode;
  showOutline: boolean;
  imageStorage: ImageStorage;
  uiStyle: UiStyle;
}

const DEFAULT: AppSettings = {
  editorMode: "split",
  showArchived: false,
  theme: "dark",
  showOutline: true,
  imageStorage: "github-attachments",
  uiStyle: "beautiful",
};

function applyTheme(theme: ThemeMode) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.dataset.theme = resolved;
}

function applyUiStyle(style: UiStyle) {
  document.documentElement.dataset.uiStyle = style;
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem("odoginote.settings");
      return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
    } catch {
      return DEFAULT;
    }
  });

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    applyUiStyle(settings.uiStyle);
  }, [settings.uiStyle]);

  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings.theme]);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("odoginote.settings", JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, updateSettings: update };
}

export interface TabItem {
  number: number;
  title: string;
  pinned?: boolean;
}

export function useTabs(vaultKey: string) {
  const storageKey = `odoginote.tabs.${vaultKey}`;

  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeNumber, setActiveNumber] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      const loaded: TabItem[] = raw ? JSON.parse(raw) : [];
      setTabs(loaded);
      setActiveNumber(loaded[0]?.number ?? null);
    } catch {
      setTabs([]);
      setActiveNumber(null);
    }
  }, [storageKey]);

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(tabs));
  }, [tabs, storageKey]);

  const openTab = useCallback((item: TabItem) => {
    setTabs((prev) => {
      if (prev.some((t) => t.number === item.number)) return prev;
      const pinned = prev.filter((t) => t.pinned);
      const unpinned = prev.filter((t) => !t.pinned);
      return [...pinned, ...unpinned, item];
    });
    setActiveNumber(item.number);
  }, []);

  const closeTab = useCallback((number: number) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.number !== number);
      setActiveNumber((cur) => {
        if (cur !== number) return cur;
        return next[next.length - 1]?.number ?? null;
      });
      return next;
    });
  }, []);

  const updateTabTitle = useCallback((number: number, title: string) => {
    setTabs((prev) => prev.map((t) => (t.number === number ? { ...t, title } : t)));
  }, []);

  const togglePin = useCallback((number: number) => {
    setTabs((prev) => {
      const updated = prev.map((t) =>
        t.number === number ? { ...t, pinned: !t.pinned } : t
      );
      const pinned = updated.filter((t) => t.pinned);
      const unpinned = updated.filter((t) => !t.pinned);
      return [...pinned, ...unpinned];
    });
  }, []);

  const reorderTabs = useCallback((from: number, to: number) => {
    setTabs((prev) => {
      const fromTab = prev[from];
      const toTab = prev[to];
      if (!fromTab || !toTab) return prev;
      if (!!fromTab.pinned !== !!toTab.pinned) return prev;

      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  return {
    tabs,
    activeNumber,
    setActiveNumber,
    openTab,
    closeTab,
    updateTabTitle,
    togglePin,
    reorderTabs,
  };
}
