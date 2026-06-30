export const NOTE_LABEL = "odoginote:note";
export const FOLDERS_PATH = ".odoginote/folders.json";
export const CONFIG_PATH = ".odoginote/config.json";
export const ASSETS_DIR = ".odoginote/assets";

export const IMAGE_MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export type NoteType = "markdown" | "excalidraw" | "ipynb";

export interface NoteMeta {
  folder: string;
  tags: string[];
  daily?: string;
  type?: NoteType;
}

export interface NoteSummary {
  number: number;
  title: string;
  folder: string;
  tags: string[];
  daily?: string;
  type?: NoteType;
  state: "open" | "closed";
  updatedAt: string;
  content?: string;
}

export interface NoteDetail extends NoteSummary {
  content: string;
}

export interface VaultConfig {
  owner: string;
  repo: string;
}

export interface VaultSummary {
  id: string;
  owner: string;
  repo: string;
  lastOpenedAt: string | null;
}

export interface UserInfo {
  id: string;
  login: string;
  avatarUrl: string;
  vaults: VaultSummary[];
  activeVault: VaultConfig | null;
}

export type SidebarPanel = "explorer" | "search" | "tags" | "graph" | "settings";

export type EditorMode = "split" | "edit" | "preview";

export type ThemeMode = "dark" | "light" | "system";

export type ImageStorage = "github-attachments" | "repo";

export const USER_ATTACHMENTS_PREFIX = "https://github.com/user-attachments/assets/";

export const GITHUB_LEGACY_IMAGE_PREFIX = "https://user-images.githubusercontent.com/";

export function isGitHubAttachmentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "github.com" && parsed.pathname.startsWith("/user-attachments/assets/")) {
      return true;
    }
    if (parsed.hostname === "user-images.githubusercontent.com") {
      return true;
    }
  } catch {
    /* invalid URL */
  }
  return (
    url.startsWith(USER_ATTACHMENTS_PREFIX) || url.startsWith(GITHUB_LEGACY_IMAGE_PREFIX)
  );
}
