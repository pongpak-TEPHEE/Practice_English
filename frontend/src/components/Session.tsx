import { useEffect, useRef, useState } from "react";
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
const LEAVE_MS = 220; // matches the card's fly-out transition

interface Step {
  word: Word;
  result: Result;
  queueBefore: Word[];
}

// Answers stay on this device until the session is saved at the end, so leaving
// part-way counts nothing and any answer can be taken back.
export function Session({ title, mode, words, accent, onExit }: Props) {
  const [queue, setQueue] = useState(words);
  const [steps, setSteps] = useState<Step[]>([]);
  const [turn, setTurn] = useState(0); // forces a fresh card even when the same word repeats
  const [favs, setFavs] = useState<Record<number, boolean>>({});
  const [confirmExit, setConfirmExit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");
  const advance = useRef<number | undefined>(undefined);

  const total = words.length;
  const current = queue[0];
  const done = total - new Set(queue.map((w) => w.id)).size;
  const passed = steps.filter((s) => s.result === "pass").length;
  const failed = steps.length - passed;
  const practised = new Set(steps.map((s) => s.word.id)).size;
  const last = steps.at(-1);

  useEffect(() => () => window.clearTimeout(advance.current), []);

  // Closing or reloading the tab mid-session would lose the answers, so ask first.
  useEffect(() => {
    if (steps.length === 0) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [steps.length]);

  const answer = (result: Result) => {
    const word = queue[0];
    const before = queue;
    setSteps((s) => [...s, { word, result, queueBefore: before }]);
    setAnnounce("");

    const rest = before.slice(1);
    let next = rest;
    if (mode === "learn" && result === "fail") {
      const at = Math.min(RETRY_GAP, rest.length);
      next = [...rest.slice(0, at), word, ...rest.slice(at)];
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    advance.current = window.setTimeout(
      () => {
        advance.current = undefined;
        setQueue(next);
        setTurn((t) => t + 1);
      },
      reduce ? 0 : LEAVE_MS,
    );
  };

  const undo = () => {
    if (!last || saving) return;
    window.clearTimeout(advance.current);
    advance.current = undefined;
    setSteps((s) => s.slice(0, -1));
    setQueue(last.queueBefore);
    setTurn((t) => t + 1);
    setError("");
    setAnnounce(`ย้อนกลับไปที่คำว่า ${last.word.word}`);
  };

  const requestExit = () => {
    if (steps.length === 0) onExit();
    else setConfirmExit(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.answers(
        mode,
        steps.map((s) => ({ wordId: s.word.id, result: s.result })),
      );
      setSteps([]); // nothing left to lose, so leaving no longer asks
      onExit();
    } catch (e) {
      setError(`บันทึกไม่สำเร็จ: ${(e as Error).message} กดบันทึกผลอีกครั้งได้เลย`);
      setSaving(false);
    }
  };

  const favorite = (fav: boolean) => {
    const id = current.id;
    setFavs((f) => ({ ...f, [id]: fav }));
    // Favourites are not part of practice, so they are saved straight away.
    api.favorite(id, fav).catch((e: Error) => {
      setFavs((f) => ({ ...f, [id]: !fav }));
      setError(`เก็บคำโปรดไม่สำเร็จ: ${e.message}`);
    });
  };

  // Backspace or Ctrl/Cmd+Z takes back the last answer; Escape asks to leave.
  useEffect(() => {
    if (confirmExit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Backspace" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        undo();
      } else if (e.key === "Escape") requestExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const undoButton = (
    <button type="button" className="text-btn undo" disabled={!last || saving} onClick={undo}>
      {last ? `ย้อนกลับคำว่า ${last.word.word}` : "ย้อนกลับ"}
    </button>
  );

  return (
    <div className="session">
      <header className="session-bar">
        <button type="button" className="text-btn" onClick={requestExit}>
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

      <p className="sr-only" role="status">
        {announce}
      </p>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      {current ? (
        <>
          <Flashcard
            key={turn}
            word={current}
            accent={accent}
            favorite={favs[current.id] ?? current.progress?.favorite ?? false}
            paused={confirmExit}
            onAnswer={answer}
            onFavorite={favorite}
          >
            {undoButton}
            <p className="hint touch-only">เอียงบัตรไปขวาเมื่อจำได้ ไปซ้ายเมื่อจำไม่ได้ ลากนิดเดียวแล้วปล่อยได้เลย</p>
            <p className="hint pointer-only">
              ลากบัตรให้เอียงแล้วปล่อย หรือกด{" "}
              <span className="keys">
                <kbd>←</kbd> ไม่ผ่าน
              </span>{" "}
              <span className="keys">
                <kbd>→</kbd> ผ่าน
              </span>{" "}
              <span className="keys">
                <kbd>Space</kbd> พลิกบัตร
              </span>{" "}
              <span className="keys">
                <kbd>Backspace</kbd> ย้อนกลับ
              </span>
            </p>
          </Flashcard>
        </>
      ) : (
        <div className="session-end">
          <h2>ครบ {total} คำแล้ว</h2>
          <p>
            ผ่าน {passed} ครั้ง ไม่ผ่าน {failed} ครั้ง
            {mode === "learn" && failed > 0 ? " คำที่ไม่ผ่านถูกวนกลับมาจนผ่านครบทุกคำแล้ว" : ""}
          </p>
          <p className="session-end-note">ผลของรอบนี้จะถูกนับเมื่อกดบันทึกผล</p>
          <button type="button" className="primary" disabled={saving} onClick={save}>
            {saving ? "กำลังบันทึก" : "บันทึกผล"}
          </button>
          {undoButton}
        </div>
      )}

      {confirmExit && (
        <ExitDialog
          count={practised}
          onStay={() => setConfirmExit(false)}
          onLeave={() => {
            setSteps([]);
            onExit();
          }}
        />
      )}
    </div>
  );
}

function ExitDialog({ count, onStay, onLeave }: { count: number; onStay: () => void; onLeave: () => void }) {
  const stayRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    stayRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onStay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="dialog-backdrop" onClick={onStay}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="exit-title"
        aria-describedby="exit-body"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="exit-title">ออกจากรอบนี้?</h2>
        <p id="exit-body">
          ฝึกไปแล้ว {count} คำในรอบนี้ ถ้าออกตอนนี้ผลจะไม่ถูกบันทึก และคำเหล่านี้จะไม่นับว่าเคยฝึกมาก่อน
        </p>
        <div className="dialog-actions">
          <button ref={stayRef} type="button" className="primary" onClick={onStay}>
            ฝึกต่อ
          </button>
          <button type="button" className="secondary danger" onClick={onLeave}>
            ออกโดยไม่บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
