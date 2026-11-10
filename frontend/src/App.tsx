import { useEffect, useState } from "react";
import { api, ApiError, getToken, setToken } from "./api";
import { Session } from "./components/Session";
import type { SessionSpec } from "./components/Session";
import { GoalsPage } from "./pages/GoalsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { LearnPage } from "./pages/LearnPage";
import { VocabPage } from "./pages/VocabPage";
import { GrammarPage } from "./pages/GrammarPage";
import { LessonPage } from "./pages/LessonPage";
import { ReadingPage } from "./pages/ReadingPage";
import { ReadingSetPage } from "./pages/ReadingSetPage";
import { ReviewPage } from "./pages/ReviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WordsPage } from "./pages/WordsPage";
import type { Accent, Level } from "./types";

// Main tabs; the vocab tab also owns the four study pages reached from it.
const TABS = [
  { id: "home", label: "หน้าแรก" },
  { id: "vocab", label: "ท่องศัพท์" },
  { id: "grammar", label: "ไวยากรณ์" },
  { id: "reading", label: "การอ่าน" },
  { id: "words", label: "คำศัพท์" },
  { id: "settings", label: "ตั้งค่า" },
] as const;
const STUDY = [
  { id: "learn", label: "ท่องศัพท์ใหม่" },
  { id: "review", label: "ทวนศัพท์เก่า" },
  { id: "history", label: "ประวัติ" },
  { id: "goals", label: "ความสำเร็จ" },
] as const;
const PAGE_IDS = [
  "home",
  "grammar",
  "lesson",
  "reading",
  "readingSet",
  "vocab",
  "learn",
  "review",
  "history",
  "goals",
  "words",
  "settings",
] as const;
type PageId = (typeof PAGE_IDS)[number];
const TAB_OF: Record<PageId, string> = {
  home: "home",
  grammar: "grammar",
  lesson: "grammar",
  reading: "reading",
  readingSet: "reading",
  vocab: "vocab",
  learn: "vocab",
  review: "vocab",
  history: "vocab",
  goals: "vocab",
  words: "words",
  settings: "settings",
};

// "#/grammar/<lesson>" and "#/reading/<set>" open one item; everything else is "#/<page>".
function itemFromHash(): { section: string; id: string } {
  const m = /^#\/(grammar|reading)\/([\w-]+)/.exec(window.location.hash);
  return m ? { section: m[1], id: m[2] } : { section: "", id: "" };
}

function lessonFromHash(): string {
  const item = itemFromHash();
  return item.section ? item.id : "";
}

function pageFromHash(): PageId {
  const item = itemFromHash();
  if (item.section === "grammar") return "lesson";
  if (item.section === "reading") return "readingSet";
  const id = window.location.hash.replace("#/", "");
  return (PAGE_IDS as readonly string[]).includes(id) ? (id as PageId) : "home";
}

export function App() {
  const [signedIn, setSignedIn] = useState(Boolean(getToken()));
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [lessonId, setLessonId] = useState(lessonFromHash);
  const [session, setSession] = useState<SessionSpec | null>(null);
  const [accent, setAccent] = useState<Accent>("us");
  const [level, setLevel] = useState<Level>("A1");
  const [error, setError] = useState("");
  const [visit, setVisit] = useState(0); // remounts the page after a session so it reloads

  useEffect(() => {
    const onHash = () => {
      setPage(pageFromHash());
      setLessonId(lessonFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (signedIn)
      api
        .settings()
        .then((s) => {
          setAccent(s.accent);
          setLevel(s.level);
        })
        .catch(handleError);
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

  const changeLevel = async (l: Level) => {
    try {
      const s = await api.saveSettings({ level: l });
      setLevel(s.level);
    } catch (e) {
      handleError(e as Error);
    }
  };

  const tab = TAB_OF[page];
  const link = (id: PageId) => ({
    href: `#/${id}`,
    className: page === id ? "is-on" : "",
    "aria-current": page === id ? ("page" as const) : undefined,
  });

  return (
    <div className="shell">
      <aside className="sidebar">
        <p className="brand">ฝึกเพื่อสอบ TOEIC</p>
        <nav aria-label="เมนูหลัก">
          <a {...link("home")}>หน้าแรก</a>
          <a {...link("vocab")}>
            ท่องศัพท์ <span className="nav-level">{level}</span>
          </a>
          <div className="nav-sub">
            {STUDY.map((p) => (
              <a key={p.id} {...link(p.id)}>
                {p.label}
              </a>
            ))}
          </div>
          <a {...link("grammar")} className={tab === "grammar" ? "is-on" : ""}>
            ไวยากรณ์
          </a>
          <a {...link("reading")} className={tab === "reading" ? "is-on" : ""}>
            การอ่าน Part 6–7
          </a>
          <a {...link("words")}>คำศัพท์ทั้งหมด</a>
          <a {...link("settings")}>ตั้งค่า</a>
        </nav>
      </aside>

      <main key={`${page}-${lessonId}-${visit}`}>
        {error && (
          <p className="notice" role="alert" onClick={() => setError("")}>
            {error}
          </p>
        )}
        {page === "home" && <HomePage onError={handleError} />}
        {page === "grammar" && <GrammarPage onError={handleError} />}
        {page === "lesson" && <LessonPage id={lessonId} accent={accent} onError={handleError} />}
        {page === "reading" && <ReadingPage onError={handleError} />}
        {page === "readingSet" && <ReadingSetPage id={lessonId} onError={handleError} />}
        {page === "vocab" && <VocabPage key={level} level={level} onLevel={changeLevel} onError={handleError} />}
        {page === "learn" && <LearnPage key={level} onStart={start} onError={handleError} />}
        {page === "review" && <ReviewPage level={level} onStart={start} onError={handleError} />}
        {page === "history" && <HistoryPage level={level} onError={handleError} />}
        {page === "goals" && <GoalsPage onError={handleError} />}
        {page === "words" && <WordsPage onError={handleError} />}
        {page === "settings" && (
          <SettingsPage
            onSaved={(s) => {
              setAccent(s.accent);
              setLevel(s.level);
            }}
            onError={handleError}
            onSignOut={() => setSignedIn(false)}
          />
        )}
      </main>

      <nav className="tabbar" aria-label="เมนูหลัก">
        {TABS.map((p) => (
          <a
            key={p.id}
            href={`#/${p.id}`}
            className={tab === p.id ? "is-on" : ""}
            aria-current={tab === p.id ? "page" : undefined}
          >
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
      <h1>ฝึกเพื่อสอบ TOEIC</h1>
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
