import type { Mode, Result, Settings, Stats, Today, Word } from "./types";

// Empty in development (Vite proxies /api); set VITE_API_URL to the Render URL for production.
const BASE = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "toeic-vocab-token";

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode): the token lasts for this page only.
  }
  memoryToken = token;
}

let memoryToken = "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        Authorization: `Bearer ${getToken() || memoryToken}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText);
  return data as T;
}

export const api = {
  today: (extra = 0) => request<Today>("GET", `/api/today${extra ? `?extra=${extra}` : ""}`),
  words: (params: { deck?: string; level?: string; status?: string; q?: string }) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return request<Word[]>("GET", `/api/words?${qs}`);
  },
  answer: (wordId: number, result: Result, mode: Mode) =>
    request<Word>("POST", "/api/answer", { wordId, result, mode }),
  favorite: (wordId: number, favorite: boolean) =>
    request<Word>("PUT", `/api/words/${wordId}/favorite`, { favorite }),
  stats: () => request<Stats>("GET", "/api/stats"),
  settings: () => request<Settings>("GET", "/api/settings"),
  saveSettings: (s: Partial<Settings>) => request<Settings>("PUT", "/api/settings", s),
};
