import { useRef, useState } from "react";
import { api } from "../api";
import type { Accent, Mode, Result, Word } from "../types";
import { Flashcard } from "./Flashcard";

export interface SessionSpec {
  title: string;
  mode: Mode;
  words: Word[];
}

interface Props extends SessionSpec {
  accent: Accent;
  onExit: () => void;
}

const RETRY_GAP = 3; // in learn mode a failed word comes back after this many cards

export function Session({ title, mode, words, accent, onExit }: Props) {
  const [queue, setQueue] = useState(words);
  const [turn, setTurn] = useState(0); // forces a fresh card even when the same word repeats
  const [passed, setPassed] = useState(0);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState("");
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const total = words.length;

  const current = queue[0];
  const done = total - new Set(queue.map((w) => w.id)).size;

  // Answers are saved in order, one at a time, while the next card is already showing.
  const save = (fn: () => Promise<Word>, onSaved?: (w: Word) => void) => {
    saving.current = saving.current
      .then(fn)
      .then((w) => {
        setError("");
        onSaved?.(w);
      })
      .catch((e: Error) => setError(`บันทึกไม่สำเร็จ: ${e.message}`));
  };

  const answer = (result: Result) => {
    const w = queue[0];
    save(() => api.answer(w.id, result, mode));
    if (result === "pass") setPassed((n) => n + 1);
    else setFailed((n) => n + 1);

    setQueue((q) => {
      const rest = q.slice(1);
      if (mode === "learn" && result === "fail") {
        const at = Math.min(RETRY_GAP, rest.length);
        return [...rest.slice(0, at), w, ...rest.slice(at)];
      }
      return rest;
    });
    setTurn((t) => t + 1);
  };

  const favorite = (fav: boolean) => {
    const id = queue[0].id;
    const setFav = (w: Word): Word =>
      w.id === id ? { ...w, progress: { ...(w.progress ?? emptyProgress(id)), favorite: fav } } : w;
    setQueue((q) => q.map(setFav));
    save(() => api.favorite(id, fav));
  };

  return (
    <div className="session">
      <header className="session-bar">
        <button type="button" className="text-btn" onClick={onExit}>
          ออก
        </button>
        <span className="session-title">{title}</span>
        <span className="session-count">
          {Math.min(done + (current ? 1 : 0), total)}/{total}
        </span>
      </header>
      <div className="meter" aria-hidden>
        <span style={{ width: `${(done / Math.max(total, 1)) * 100}%` }} />
      </div>

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      {current ? (
        <Flashcard key={turn} word={current} accent={accent} onAnswer={answer} onFavorite={favorite} />
      ) : (
        <div className="session-end">
          <h2>{mode === "learn" ? "ท่องครบแล้ว" : "ทวนรอบนี้ครบแล้ว"}</h2>
          <p>
            ผ่าน {passed} ครั้ง และไม่ผ่าน {failed} ครั้ง
            {mode === "learn" && failed > 0 ? " คำที่ไม่ผ่านถูกวนกลับมาจนผ่านครบทุกคำแล้ว" : ""}
          </p>
          <button type="button" className="primary" onClick={onExit}>
            กลับหน้าวันนี้
          </button>
        </div>
      )}

      {current && <p className="keys-hint">ลากบัตรไปขวาเมื่อจำได้ ไปซ้ายเมื่อจำไม่ได้</p>}
    </div>
  );
}

function emptyProgress(wordId: number) {
  return {
    wordId,
    dueDate: "",
    lastReviewed: "",
    favorite: false,
    passCount: 0,
    failCount: 0,
    passDays: 0,
    recent: "",
    missed: false,
    learnedDate: "",
    roundDate: "",
    roundsToday: 0,
  };
}
