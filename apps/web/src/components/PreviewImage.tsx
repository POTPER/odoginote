import { useEffect, useMemo, useState } from "react";
import { resolvePreviewImageSrc } from "../lib/image-url";

interface Props {
  src?: string;
  alt?: string;
  onNeedGitHubSession?: () => void;
}

export default function PreviewImage({ src, alt, onNeedGitHubSession }: Props) {
  const resolved = useMemo(() => resolvePreviewImageSrc(src), [src]);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFailed(false);
    setLoading(true);
    setBlobUrl(null);

    if (!resolved) {
      setFailed(true);
      setLoading(false);
      return;
    }

    if (!resolved.startsWith("/api/assets/")) {
      setBlobUrl(resolved);
      setLoading(false);
      return;
    }

    let objectUrl: string | null = null;
    const controller = new AbortController();

    fetch(resolved, { credentials: "include", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) throw new Error("auth");
        const blob = await res.blob();
        if (!blob.type.startsWith("image/") && !ct.startsWith("image/")) {
          throw new Error("not-image");
        }
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        setFailed(true);
        setLoading(false);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resolved]);

  if (loading) {
    return <div className="preview-img-placeholder">加载图片…</div>;
  }

  if (failed || !blobUrl) {
    return (
      <button
        type="button"
        className="preview-img-error"
        onClick={onNeedGitHubSession}
        title="前往设置连接 GitHub 会话"
      >
        图片无法预览
        {resolved?.includes("proxy") && " — 请在设置中连接 GitHub user_session"}
      </button>
    );
  }

  return <img src={blobUrl} alt={alt ?? ""} loading="lazy" />;
}
