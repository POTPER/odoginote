import type {
  FileTreeNode,
  GraphEdge,
  GraphNode,
  ImageStorage,
  NoteDetail,
  NoteSummary,
  NoteType,
  UserInfo,
  VaultSummary,
} from "@odoginote/shared";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = (err as { error?: string }).error ?? "Request failed";
    const code = (err as { code?: string }).code;
    const error = new Error(message) as Error & { code?: string };
    if (code) error.code = code;
    throw error;
  }

  return res.json() as Promise<T>;
}

export const api = {
  getMe: () => request<UserInfo>("/api/auth/me"),
  listVaults: () =>
    request<{ vaults: VaultSummary[]; activeVault: { owner: string; repo: string } | null }>(
      "/api/vaults"
    ),
  listRepos: () =>
    request<Array<{ name: string; fullName: string; owner: string; private: boolean }>>(
      "/api/vaults/repos"
    ),
  setupVault: (data: {
    mode: "create" | "existing";
    repoName?: string;
    owner?: string;
    repo?: string;
  }) =>
    request<{ owner: string; repo: string; vault: VaultSummary }>("/api/vaults/setup", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  switchVault: (owner: string, repo: string) =>
    request<{ activeVault: { owner: string; repo: string } }>("/api/vaults/switch", {
      method: "POST",
      body: JSON.stringify({ owner, repo }),
    }),
  deleteVault: (id: string) =>
    request<{ vaults: VaultSummary[]; activeVault: { owner: string; repo: string } | null }>(
      `/api/vaults/${id}`,
      { method: "DELETE" }
    ),
  getFolders: () =>
    request<{ folders: string[]; tree: FileTreeNode[]; notes: NoteSummary[] }>("/api/folders"),
  createFolder: (path: string) =>
    request<{ folders: string[]; path: string }>("/api/folders", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  deleteFolder: (path: string) =>
    request<{ folders: string[]; path: string }>("/api/folders", {
      method: "DELETE",
      body: JSON.stringify({ path }),
    }),
  listNotes: (params?: { folder?: string; q?: string; state?: string }) => {
    const sp = new URLSearchParams();
    if (params?.folder) sp.set("folder", params.folder);
    if (params?.q) sp.set("q", params.q);
    if (params?.state) sp.set("state", params.state);
    const qs = sp.toString();
    return request<{ notes: NoteSummary[] }>(`/api/notes/index${qs ? `?${qs}` : ""}`);
  },
  getGraph: () => request<{ nodes: GraphNode[]; edges: GraphEdge[] }>("/api/notes/graph"),
  getNote: (number: number) => request<NoteDetail>(`/api/notes/${number}`),
  createNote: (data: {
    title: string;
    content?: string;
    folder?: string;
    tags?: string[];
    daily?: string;
    type?: NoteType;
  }) =>
    request<NoteDetail>("/api/notes", { method: "POST", body: JSON.stringify(data) }),
  updateNote: (
    number: number,
    data: {
      title?: string;
      content?: string;
      folder?: string;
      tags?: string[];
      state?: "open" | "closed";
      expectedUpdatedAt?: string;
    }
  ) =>
    request<NoteDetail>(`/api/notes/${number}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  uploadAsset: async (noteNumber: number, file: File, storage: ImageStorage = "github-attachments") => {
    const form = new FormData();
    form.append("file", file);
    form.append("noteNumber", String(noteNumber));
    form.append("storage", storage);
    const res = await fetch("/api/assets", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const message = (err as { error?: string }).error ?? "Upload failed";
      const code = (err as { code?: string }).code;
      const error = new Error(message) as Error & { code?: string };
      if (code) error.code = code;
      throw error;
    }
    return res.json() as Promise<{ url: string; path: string }>;
  },
  getGitHubSession: () =>
    request<{ connected: boolean; updatedAt: string | null }>("/api/auth/github-session"),
  saveGitHubSession: (userSession: string) =>
    request<{ ok: boolean; connected: boolean; updatedAt: string | null }>(
      "/api/auth/github-session",
      { method: "POST", body: JSON.stringify({ userSession }) }
    ),
  deleteGitHubSession: () =>
    request<{ ok: boolean; connected: boolean }>("/api/auth/github-session", {
      method: "DELETE",
    }),
  exportVault: () =>
    request<{
      ok: boolean;
      noteCount: number;
      fileCount: number;
      mirroredAttachments: number;
      skippedAttachments: string[];
    }>("/api/export", { method: "POST" }),
};

export function loginWithGitHub() {
  window.location.href = "/api/auth/github";
}

export function logout() {
  window.location.href = "/api/auth/logout";
}
