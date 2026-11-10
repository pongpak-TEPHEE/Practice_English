import { useEffect, useState } from "react";
import { api, ApiError, getToken, setToken } from "./api";
import { Session } from "./components/Session";
import type { SessionSpec } from "./components/Session";
import { ReviewPage } from "./pages/ReviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TodayPage } from "./pages/TodayPage";
import { WordsPage } from "./pages/WordsPage";
import type { Accent } from "./types";

const PAGES = [
  { id: "today", label: "วันนี้" },
  { id: "review", label: "ทวน" },
  { id: "words", label: "คำศัพท์" },
  { id: "settings", label: "ตั้งค่า" },
] as const;
type PageId = (typeof PAGES)[number]["id"];

function pageFromHash(): PageId {
  const id = window.location.hash.replace("#/", "");
  return PAGES.some((p) => p.id === id) ? (id as PageId) : "today";
}

export function App() {
  const [signedIn, setSignedIn] = useState(Boolean(getToken()));
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [session, setSession] = useState<SessionSpec | null>(null);
  const [accent, setAccent] = useState<Accent>("us");
  const [error, setError] = useState("");
  const [visit, setVisit] = useState(0); // remounts the page after a session so it reloads

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (signedIn) api.settings().then((s) => setAccent(s.accent)).catch(handleError);
  }, [signedIn]);

  function handleError(e: Error) {
    if (e instanceof ApiError && e.status === 401) {
      setToken("");
      setSignedIn(false);
      return;
    }
    setError(e.message);
  }

  if (!signedIn) return <SignIn onDone={() => setSignedIn(true)} />;

  if (session) {
    return (
      <Session
        {...session}
        accent={accent}
        onExit={() => {
          setSession(null);
          setVisit((v) => v + 1);
        }}
      />
    );
  }

  const start = (s: SessionSpec) => {
    if (s.words.length === 0) {
      setError("ไม่มีคำในชุดนี้ให้ฝึก");
      return;
    }
    setError("");
    setSession(s);
  };

  return (
    <div className="shell">
      <main key={`${page}-${visit}`}>
        {error && (
          <p className="notice" role="alert" onClick={() => setError("")}>
            {error}
          </p>
        )}
        {page === "today" && <TodayPage onStart={start} onError={handleError} />}
        {page === "review" && <ReviewPage onStart={start} onError={handleError} />}
        {page === "words" && <WordsPage onError={handleError} />}
        {page === "settings" && (
          <SettingsPage onSaved={(s) => setAccent(s.accent)} onError={handleError} onSignOut={() => setSignedIn(false)} />
        )}
      </main>
      <nav className="tabbar" aria-label="เมนูหลัก">
        {PAGES.map((p) => (
          <a key={p.id} href={`#/${p.id}`} className={page === p.id ? "is-on" : ""} aria-current={page === p.id ? "page" : undefined}>
            {p.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setToken(value.trim());
    try {
      await api.settings();
      onDone();
    } catch (err) {
      setToken("");
      setError(err instanceof ApiError && err.status === 401 ? "รหัสไม่ถูกต้อง ลองอีกครั้ง" : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="signin" onSubmit={submit}>
      <h1>คลังคำ TOEIC</h1>
      <p>ใส่รหัสเข้าใช้งาน (API token) ครั้งเดียว อุปกรณ์นี้จะจำไว้ให้</p>
      <input
        type="password"
        autoComplete="current-password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="รหัสเข้าใช้งาน"
        required
      />
      {error && <p className="notice">{error}</p>}
      <button type="submit" className="primary wide" disabled={busy || !value.trim()}>
        เข้าใช้งาน
      </button>
    </form>
  );
}
