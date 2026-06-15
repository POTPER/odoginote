import type { GitHubIssue, GitHubRepo, GitHubUser } from "../env";

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "odoginote-app",
};

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string
  ) {
    super(message);
  }
}

async function ghFetch<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      ...GH_HEADERS,
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new GitHubError(`GitHub API error: ${res.status}`, res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function getGitHubUser(token: string): Promise<GitHubUser> {
  return ghFetch<GitHubUser>(token, "/user");
}

export async function getRepo(
  token: string,
  owner: string,
  repo: string
): Promise<{ id: number; full_name: string }> {
  return ghFetch<{ id: number; full_name: string }>(token, `/repos/${owner}/${repo}`);
}

export async function listUserRepos(token: string): Promise<GitHubRepo[]> {
  return ghFetch<GitHubRepo[]>(token, "/user/repos?per_page=100&sort=updated");
}

export async function createRepo(
  token: string,
  name: string,
  isPrivate = true
): Promise<GitHubRepo> {
  return ghFetch<GitHubRepo>(token, "/user/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: true,
      description: "GiNote knowledge vault",
    }),
  });
}

export async function ensureLabel(
  token: string,
  owner: string,
  repo: string,
  name: string,
  color = "7c3aed"
): Promise<void> {
  try {
    await ghFetch(token, `/repos/${owner}/${repo}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color, description: "odoginote system label" }),
    });
  } catch (e) {
    if (e instanceof GitHubError && e.status === 422) return;
    throw e;
  }
}

export async function createFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string
): Promise<void> {
  await upsertRepoFile(token, owner, repo, path, content, message);
}

export async function getRepoFile(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<{ content: string; sha: string } | null> {
  try {
    const data = await ghFetch<{ content: string; sha: string; encoding: string }>(
      token,
      `/repos/${owner}/${repo}/contents/${path}`
    );
    const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
    return { content: decoded, sha: data.sha };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

export async function upsertRepoFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<void> {
  const body: Record<string, string> = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
  };
  if (sha) body.sha = sha;
  await ghFetch(token, `/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function uploadRepoBinaryFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  data: ArrayBuffer,
  message: string
): Promise<void> {
  await ghFetch(token, `/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: arrayBufferToBase64(data),
    }),
  });
}

export async function getRepoBinaryFile(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await ghFetch<{ content: string; encoding: string }>(
      token,
      `/repos/${owner}/${repo}/contents/${path}`
    );
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const contentType =
      ext === "png"
        ? "image/png"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "gif"
            ? "image/gif"
            : ext === "webp"
              ? "image/webp"
              : "application/octet-stream";
    return { data: base64ToArrayBuffer(res.content), contentType };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

export async function listIssues(
  token: string,
  owner: string,
  repo: string,
  label: string,
  state: "open" | "closed" | "all" = "open"
): Promise<GitHubIssue[]> {
  const issues: GitHubIssue[] = [];
  let page = 1;
  while (true) {
    const batch = await ghFetch<GitHubIssue[]>(
      token,
      `/repos/${owner}/${repo}/issues?labels=${encodeURIComponent(label)}&state=${state}&per_page=100&page=${page}`
    );
    const filtered = batch.filter((i) => !i.pull_request);
    issues.push(...filtered);
    if (batch.length < 100) break;
    page++;
  }
  return issues;
}

export async function getIssue(
  token: string,
  owner: string,
  repo: string,
  number: number
): Promise<GitHubIssue> {
  return ghFetch<GitHubIssue>(token, `/repos/${owner}/${repo}/issues/${number}`);
}

export async function createIssue(
  token: string,
  owner: string,
  repo: string,
  data: { title: string; body: string; labels?: string[] }
): Promise<GitHubIssue> {
  return ghFetch<GitHubIssue>(token, `/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateIssue(
  token: string,
  owner: string,
  repo: string,
  number: number,
  data: { title?: string; body?: string; state?: "open" | "closed" },
  expectedUpdatedAt?: string
): Promise<GitHubIssue> {
  if (expectedUpdatedAt) {
    const current = await getIssue(token, owner, repo, number);
    if (current.updated_at !== expectedUpdatedAt) {
      throw new GitHubError("Conflict: note was modified elsewhere", 409);
    }
  }
  return ghFetch<GitHubIssue>(token, `/repos/${owner}/${repo}/issues/${number}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<{ access_token: string }> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "odoginote-app",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new GitHubError("OAuth token exchange failed", res.status, body);
  }
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new GitHubError(data.error_description ?? data.error ?? "No access token", 400);
  }
  return { access_token: data.access_token };
}
