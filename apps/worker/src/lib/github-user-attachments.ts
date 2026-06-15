import { isGitHubAttachmentUrl } from "@odoginote/shared";
import { GitHubSessionError } from "./github-session";

const USER_AGENT = "odoginote-app";

export const USER_ATTACHMENTS_PREFIX = "https://github.com/user-attachments/assets/";

interface UploadPolicyResponse {
  upload_url: string;
  asset: {
    id: number;
    href: string;
    name: string;
    size: number;
    content_type: string;
  };
  form: Record<string, string>;
  asset_upload_authenticity_token: string;
}

function sessionCookieHeader(userSession: string): string {
  return `user_session=${userSession}; __Host-user_session_same_site=${userSession}`;
}

function mergeCookieHeader(base: string, setCookieHeaders: string[]): string {
  const jar = new Map<string, string>();
  for (const part of base.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) jar.set(k, v.join("="));
  }
  for (const header of setCookieHeaders) {
    const piece = header.split(";")[0];
    const [k, ...v] = piece.trim().split("=");
    if (k) jar.set(k, v.join("="));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function fetchUploadToken(
  owner: string,
  repo: string,
  userSession: string
): Promise<{ uploadToken: string; cookies: string }> {
  const initialCookies = sessionCookieHeader(userSession);
  const res = await fetch(`https://github.com/${owner}/${repo}`, {
    headers: {
      Cookie: initialCookies,
      "User-Agent": USER_AGENT,
      Accept: "text/html",
    },
  });

  if (!res.ok) {
    throw new GitHubSessionError("Failed to load repository page", "GITHUB_SESSION_EXPIRED");
  }

  const html = await res.text();
  const match = html.match(/"uploadToken":"([^"]+)"/);
  if (!match) {
    throw new GitHubSessionError("uploadToken not found — session may be expired", "GITHUB_SESSION_EXPIRED");
  }

  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const cookies = mergeCookieHeader(initialCookies, setCookies);
  return { uploadToken: match[1], cookies };
}

export async function uploadUserAttachment(
  userSession: string,
  owner: string,
  repo: string,
  repositoryId: number,
  fileName: string,
  mimeType: string,
  data: ArrayBuffer
): Promise<string> {
  const { uploadToken, cookies } = await fetchUploadToken(owner, repo, userSession);

  const policyForm = new FormData();
  policyForm.append("name", fileName);
  policyForm.append("size", String(data.byteLength));
  policyForm.append("content_type", mimeType);
  policyForm.append("authenticity_token", uploadToken);
  policyForm.append("repository_id", String(repositoryId));

  const policyRes = await fetch("https://github.com/upload/policies/assets", {
    method: "POST",
    headers: {
      accept: "application/json",
      origin: "https://github.com",
      referer: `https://github.com/${owner}/${repo}`,
      "x-requested-with": "XMLHttpRequest",
      Cookie: cookies,
      "User-Agent": USER_AGENT,
    },
    body: policyForm,
  });

  if (!policyRes.ok) {
    throw new GitHubSessionError(
      `Upload policy failed: ${policyRes.status}`,
      policyRes.status === 401 || policyRes.status === 422 ? "GITHUB_SESSION_EXPIRED" : "GITHUB_SESSION_EXPIRED"
    );
  }

  const policy = (await policyRes.json()) as UploadPolicyResponse;
  const s3Form = new FormData();
  for (const [key, value] of Object.entries(policy.form)) {
    s3Form.append(key, value);
  }
  s3Form.append("file", new Blob([data], { type: mimeType }), fileName);

  const s3Res = await fetch(policy.upload_url, {
    method: "POST",
    headers: {
      origin: "https://github.com",
      "User-Agent": USER_AGENT,
    },
    body: s3Form,
  });

  if (!s3Res.ok && s3Res.status !== 204) {
    throw new Error(`S3 upload failed: ${s3Res.status}`);
  }

  const finalizeForm = new FormData();
  finalizeForm.append("authenticity_token", policy.asset_upload_authenticity_token);

  const finalizeRes = await fetch(`https://github.com/upload/assets/${policy.asset.id}`, {
    method: "PUT",
    headers: {
      accept: "application/json",
      origin: "https://github.com",
      referer: `https://github.com/${owner}/${repo}`,
      "x-requested-with": "XMLHttpRequest",
      Cookie: cookies,
      "User-Agent": USER_AGENT,
    },
    body: finalizeForm,
  });

  if (!finalizeRes.ok) {
    throw new GitHubSessionError(
      `Finalize upload failed: ${finalizeRes.status}`,
      "GITHUB_SESSION_EXPIRED"
    );
  }

  return policy.asset.href;
}

export async function fetchUserAttachment(
  url: string,
  options: { userSession?: string | null; oauthToken?: string | null }
): Promise<{ data: ArrayBuffer; contentType: string }> {
  if (!isGitHubAttachmentUrl(url)) {
    throw new Error("Invalid GitHub attachment URL");
  }

  const attempts: RequestInit[] = [];

  if (options.oauthToken) {
    attempts.push({
      headers: {
        Authorization: `Bearer ${options.oauthToken}`,
        Accept: "image/*,*/*",
        "User-Agent": USER_AGENT,
      },
      redirect: "follow",
    });
  }

  if (options.userSession) {
    attempts.push({
      headers: {
        Cookie: sessionCookieHeader(options.userSession),
        Accept: "image/*,*/*",
        "User-Agent": USER_AGENT,
      },
      redirect: "follow",
    });
  }

  attempts.push({
    headers: {
      Accept: "image/*,*/*",
      "User-Agent": USER_AGENT,
    },
    redirect: "follow",
  });

  for (const init of attempts) {
    const res = await fetch(url, init);
    if (!res.ok) continue;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json") || contentType.includes("text/html")) {
      continue;
    }
    const data = await res.arrayBuffer();
    if (data.byteLength === 0) continue;
    return { data, contentType: contentType || "application/octet-stream" };
  }

  throw new GitHubSessionError(
    "Failed to fetch attachment — connect GitHub session in settings",
    "GITHUB_SESSION_EXPIRED"
  );
}

export function extractUserAttachmentUrls(content: string): string[] {
  const urls = new Set<string>();
  const markdownRe =
    /https:\/\/github\.com\/user-attachments\/assets\/[a-f0-9-]+|https:\/\/user-images\.githubusercontent\.com\/[^\s)"']+/gi;
  const htmlRe =
    /<img[^>]+src=["'](https:\/\/(?:github\.com\/user-attachments\/assets\/[^"']+|user-images\.githubusercontent\.com\/[^"']+))["']/gi;

  for (const match of content.matchAll(markdownRe)) {
    urls.add(match[0].replace(/[)\]"']+$/, ""));
  }
  for (const match of content.matchAll(htmlRe)) {
    urls.add(match[1]);
  }
  return [...urls];
}
