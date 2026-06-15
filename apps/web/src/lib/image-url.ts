import {
  GITHUB_LEGACY_IMAGE_PREFIX,
  isGitHubAttachmentUrl,
  USER_ATTACHMENTS_PREFIX,
} from "@odoginote/shared";

export function resolvePreviewImageSrc(src?: string): string | undefined {
  if (!src) return src;
  if (src.startsWith("/api/assets/")) return src;
  if (src.startsWith(".odoginote/assets/")) return `/api/assets/${src}`;
  if (isGitHubAttachmentUrl(src)) {
    return `/api/assets/proxy?url=${encodeURIComponent(src)}`;
  }
  return src;
}

/** Convert GitHub Issue HTML img tags to markdown for preview. */
export function normalizePreviewContent(content: string): string {
  const withImages = content.replace(
    /<img\b[\s\S]*?\bsrc=["'](https:\/\/(?:github\.com\/user-attachments\/assets\/[^"']+|user-images\.githubusercontent\.com\/[^"']+))["'][\s\S]*?\/?>/gi,
    (_, url: string) => `![](${url})`
  );
  return withImages.replace(/\[\[([^\]]+)\]\]/g, (_, label: string) => `[${label}](wiki:${label})`);
}

export { USER_ATTACHMENTS_PREFIX, GITHUB_LEGACY_IMAGE_PREFIX, isGitHubAttachmentUrl };
