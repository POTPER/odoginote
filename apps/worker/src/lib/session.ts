import type { Env, SessionData } from "./env";

const COOKIE_NAME = "odoginote_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function toBase64Url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function getKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(secret: string, plaintext: string): Promise<string> {
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  return `${toBase64Url(iv.buffer)}.${toBase64Url(cipher)}`;
}

async function decrypt(secret: string, payload: string): Promise<string | null> {
  try {
    const [ivB64, cipherB64] = payload.split(".");
    if (!ivB64 || !cipherB64) return null;
    const key = await getKey(secret);
    const iv = fromBase64Url(ivB64);
    const cipher = fromBase64Url(cipherB64);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export function sessionCookie(sessionId: string, maxAgeSec: number): string {
  return `${COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function getSessionId(request: Request): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function createSession(env: Env, userId: string, token: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const data: SessionData = {
    userId,
    token,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  const encrypted = await encrypt(env.SESSION_SECRET, JSON.stringify(data));
  await env.KV_SESSION.put(sessionId, encrypted, { expirationTtl: SESSION_TTL_MS / 1000 });
  return sessionId;
}

export async function getSession(env: Env, request: Request): Promise<SessionData | null> {
  const sessionId = getSessionId(request);
  if (!sessionId) return null;

  const encrypted = await env.KV_SESSION.get(sessionId);
  if (!encrypted) return null;

  const json = await decrypt(env.SESSION_SECRET, encrypted);
  if (!json) return null;

  const data = JSON.parse(json) as SessionData;
  if (data.expiresAt < Date.now()) {
    await env.KV_SESSION.delete(sessionId);
    return null;
  }
  return data;
}

export async function destroySession(env: Env, request: Request): Promise<void> {
  const sessionId = getSessionId(request);
  if (sessionId) await env.KV_SESSION.delete(sessionId);
}

export async function encryptWithSecret(secret: string, plaintext: string): Promise<string> {
  return encrypt(secret, plaintext);
}

export async function decryptWithSecret(secret: string, payload: string): Promise<string | null> {
  return decrypt(secret, payload);
}
