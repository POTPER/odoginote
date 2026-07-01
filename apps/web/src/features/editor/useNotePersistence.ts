import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteDetail } from "@odoginote/shared";
import { api } from "../../lib/api";

export type SaveStatus = "idle" | "saving" | "saved" | "conflict" | "error" | "uploading";

export interface NoteFields {
  title: string;
  content: string;
  folder: string;
  tagsStr: string;
}

interface Options {
  note: NoteDetail;
  onUpdate: (note: NoteDetail) => void;
  onSaveStatus?: (status: string) => void;
  onContentChange?: (content: string) => void;
}

export function useNotePersistence({ note, onUpdate, onSaveStatus, onContentChange }: Options) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [folder, setFolder] = useState(note.folder);
  const [tagsStr, setTagsStr] = useState(note.tags.join(", "));
  const [status, setStatus] = useState<SaveStatus>("idle");

  const updatedAtRef = useRef(note.updatedAt);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const uploadingRef = useRef(false);
  const onUpdateRef = useRef(onUpdate);
  const baselineRef = useRef<NoteFields>({
    title: note.title,
    content: note.content,
    folder: note.folder,
    tagsStr: note.tags.join(", "),
  });
  const fieldsRef = useRef<NoteFields>({ title, content, folder, tagsStr });

  useEffect(() => {
    fieldsRef.current = { title, content, folder, tagsStr };
  }, [title, content, folder, tagsStr]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    onContentChange?.(content);
  }, [content, onContentChange]);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setFolder(note.folder);
    setTagsStr(note.tags.join(", "));
    updatedAtRef.current = note.updatedAt;
    baselineRef.current = {
      title: note.title,
      content: note.content,
      folder: note.folder,
      tagsStr: note.tags.join(", "),
    };
    setStatus("idle");
  }, [note.number, note.updatedAt, note.title, note.content, note.folder, note.tags]);

  useEffect(() => {
    const statusText = {
      idle: "",
      saving: "保存中...",
      saved: "已保存",
      conflict: "冲突",
      error: "保存失败",
      uploading: "上传图片中...",
    }[status];
    onSaveStatus?.(statusText);
  }, [status, onSaveStatus]);

  const persistNote = useCallback(async () => {
    const { title: t, content: c, folder: f, tagsStr: ts } = fieldsRef.current;
    const tags = ts
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const updated = await api.updateNote(note.number, {
      title: t,
      content: c,
      folder: f,
      tags,
      expectedUpdatedAt: updatedAtRef.current,
    });
    updatedAtRef.current = updated.updatedAt;
    baselineRef.current = {
      title: updated.title,
      content: updated.content,
      folder: updated.folder,
      tagsStr: updated.tags.join(", "),
    };
    onUpdateRef.current(updated);
    setStatus("saved");
  }, [note.number]);

  useEffect(() => {
    const baseline = baselineRef.current;
    if (
      title === baseline.title &&
      content === baseline.content &&
      folder === baseline.folder &&
      tagsStr === baseline.tagsStr
    ) {
      return;
    }
    if (uploadingRef.current) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await persistNote();
      } catch (e) {
        setStatus(e instanceof Error && e.message.includes("Conflict") ? "conflict" : "error");
      }
    }, 2000);

    return () => clearTimeout(timerRef.current);
  }, [title, content, folder, tagsStr, note.number, persistNote]);

  const saveNow = useCallback(async () => {
    clearTimeout(timerRef.current);
    if (uploadingRef.current) return;
    const baseline = baselineRef.current;
    const { title: t, content: c, folder: f, tagsStr: ts } = fieldsRef.current;
    if (t === baseline.title && c === baseline.content && f === baseline.folder && ts === baseline.tagsStr) {
      return;
    }
    setStatus("saving");
    try {
      await persistNote();
    } catch (e) {
      setStatus(e instanceof Error && e.message.includes("Conflict") ? "conflict" : "error");
    }
  }, [persistNote]);

  return {
    title,
    setTitle,
    content,
    setContent,
    folder,
    setFolder,
    tagsStr,
    setTagsStr,
    status,
    setStatus,
    uploadingRef,
    saveNow,
    persistNote,
  };
}
