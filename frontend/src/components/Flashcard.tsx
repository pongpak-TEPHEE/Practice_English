import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { playWord } from "../audio";
import type { Accent, Result, Word } from "../types";

interface Props {
  word: Word;
  accent: Accent;
  favorite: boolean;
  paused: boolean; // ignore keys while a dialog is open
  onAnswer: (result: Result) => void;
  onFavorite: (favorite: boolean) => void;
  children?: ReactNode; // extra controls shown under the answer buttons
}

const TAP_SLOP = 8; // px a pointer may move and still count as a tap
const COMMIT_TILT = 15; // degrees of tilt when the card reaches the commit point

export function Flashcard({ word, accent, favorite, paused, onAnswer, onFavorite, children }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<Result | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; moved: boolean; dx: number } | null>(null);

  // A short drag is enough: about a fifth of the card, never more than 120px.
  const commitDistance = () => Math.min(120, Math.max(70, (cardRef.current?.offsetWidth ?? 320) * 0.22));

  const commit = (result: Result) => {
    if (leaving) return;
    setLeaving(result);
    setDragging(false);
    onAnswer(result);
  };

  // Ends a drag. Releases outside the window or a lost pointer capture also land
  // here, so the card can never stay stuck mid-drag.
  const finish = (allowTap: boolean) => {
    const g = drag.current;
    drag.current = null;
    if (!g) return;
    setDragging(false);
    if (!g.moved) {
      if (allowTap) setFlipped((f) => !f);
    } else if (Math.abs(g.dx) >= commitDistance()) {
      commit(g.dx > 0 ? "pass" : "fail");
      return;
    }
    setDx(0);
  };

  useEffect(() => {
    const onBlur = () => finish(false);
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  });

  // Keyboard: arrows answer, space flips, E shows the example, S plays the sound.
  useEffect(() => {
    if (paused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") commit("pass");
      else if (e.key === "ArrowLeft") commit("fail");
      else if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key.toLowerCase() === "e") setShowExample((s) => !s);
      else if (e.key.toLowerCase() === "s") playWord(word, accent);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onPointerDown = (e: ReactPointerEvent) => {
    if (leaving || e.button !== 0 || drag.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture can fail if the pointer is already gone; the drag still works inside the card.
    }
    drag.current = { id: e.pointerId, x: e.clientX, moved: false, dx: 0 };
    setDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const g = drag.current;
    if (!g || e.pointerId !== g.id) return;
    if (e.pointerType === "mouse" && e.buttons === 0) {
      finish(false); // the button was released somewhere we never heard about
      return;
    }
    const d = e.clientX - g.x;
    if (Math.abs(d) > TAP_SLOP) g.moved = true;
    if (g.moved) {
      g.dx = d;
      setDx(d);
    }
  };

  const limit = commitDistance();
  const progress = leaving ? 1 : Math.min(Math.abs(dx) / limit, 1);
  const armed = !leaving && Math.abs(dx) >= limit;
  const side = leaving ? (leaving === "pass" ? 1 : -1) : Math.sign(dx);
  // Past the commit point the card only creeps a little further, so there's no reason to drag on.
  const extra = Math.max(0, Math.abs(dx) - limit);
  const shift = leaving ? window.innerWidth : Math.min(Math.abs(dx), limit) + Math.min(extra * 0.2, limit * 0.4);
  const tilt = COMMIT_TILT * progress;
  const leaning: Result | null = leaving ?? (dx > 0 ? "pass" : dx < 0 ? "fail" : null);

  return (
    <div className="card-area">
      <div className="card-stage">
        <div
          ref={cardRef}
          className={`card ${dragging ? "is-dragging" : ""} ${leaving ? "is-leaving" : ""}`}
          style={{ transform: `translateX(${side * shift}px) rotate(${side * tilt}deg)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => e.pointerId === drag.current?.id && finish(true)}
          onPointerCancel={() => finish(false)}
          onLostPointerCapture={() => finish(false)}
          role="button"
          tabIndex={0}
          aria-label={flipped ? `${word.word}: ${word.meaningTh}` : `${word.word}, แตะเพื่อดูคำแปล`}
          onKeyDown={(e) => {
            if (e.key === "Enter") setFlipped((f) => !f);
          }}
        >
          <div className={`card-inner ${flipped ? "is-flipped" : ""}`}>
            <div className="card-face card-front">
              <span className="card-level">{word.level}</span>
              <h2 className="headword">{word.word}</h2>
              <p className="pos">{word.pos}</p>
              <p className="card-hint">แตะเพื่อดูคำแปล</p>
            </div>
            <div className="card-face card-back">
              <span className="card-level">{word.level}</span>
              <p className="back-word">
                {word.word} <span className="pos">{word.pos}</span>
              </p>
              <p className="meaning">{word.meaningTh}</p>
            </div>
          </div>
          {leaning && (
            <div className={`verdict verdict-${leaning}`} style={{ opacity: progress }} aria-hidden>
              <span>{leaning === "pass" ? "ผ่าน" : "ไม่ผ่าน"}</span>
              {armed && <span className="verdict-hint">ปล่อยได้เลย</span>}
            </div>
          )}
        </div>
      </div>

      <div className="card-panel">
        <div className="card-tools">
          <button type="button" className="text-btn" onClick={() => playWord(word, accent)}>
            ฟังเสียง
          </button>
          <button
            type="button"
            className={`text-btn ${showExample ? "is-on" : ""}`}
            aria-expanded={showExample}
            onClick={() => setShowExample((s) => !s)}
          >
            ประโยคตัวอย่าง
          </button>
          <button
            type="button"
            className={`text-btn ${favorite ? "is-fav" : ""}`}
            aria-pressed={favorite}
            onClick={() => onFavorite(!favorite)}
          >
            {favorite ? "คำโปรดแล้ว" : "เก็บเป็นคำโปรด"}
          </button>
        </div>

        {showExample && (
          <p className="example" lang="en">
            <Highlighted sentence={word.example} word={word.word} />
          </p>
        )}

        <div className="answer-row">
          <button
            type="button"
            className="answer answer-fail"
            disabled={Boolean(leaving)}
            onClick={() => commit("fail")}
          >
            ไม่ผ่าน
          </button>
          <button
            type="button"
            className="answer answer-pass"
            disabled={Boolean(leaving)}
            onClick={() => commit("pass")}
          >
            ผ่าน
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Bolds the first form of the word found in the sentence (e.g. "delivered" for "deliver").
function Highlighted({ sentence, word }: { sentence: string; word: string }) {
  if (!sentence) return <>ยังไม่มีประโยคตัวอย่างสำหรับคำนี้</>;
  const base = word.replace(/™/g, "").toLowerCase();
  const stem = base.length > 4 ? base.slice(0, -2) : base;
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`\\b${escaped}[\\w'-]*`, "i").exec(sentence);
  if (!m) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, m.index)}
      <strong>{m[0]}</strong>
      {sentence.slice(m.index + m[0].length)}
    </>
  );
}
