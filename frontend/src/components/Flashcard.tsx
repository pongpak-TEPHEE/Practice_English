import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { playWord } from "../audio";
import type { Accent, Result, Word } from "../types";

interface Props {
  word: Word;
  accent: Accent;
  onAnswer: (result: Result) => void;
  onFavorite: (favorite: boolean) => void;
}

const TAP_SLOP = 8; // px a pointer may move and still count as a tap

export function Flashcard({ word, accent, onAnswer, onFavorite }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<Result | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);

  const threshold = () => Math.min(120, (cardRef.current?.offsetWidth ?? 320) * 0.3);
  const favorite = word.progress?.favorite ?? false;

  const commit = (result: Result) => {
    if (leaving) return;
    setLeaving(result);
    setDragging(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => onAnswer(result), reduce ? 0 : 220);
  };

  // Keyboard: arrows answer, space flips, E shows the example, S plays the sound.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
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
    if (leaving || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const d = e.clientX - drag.current.x;
    if (Math.abs(d) > TAP_SLOP) drag.current.moved = true;
    if (drag.current.moved) setDx(d);
  };
  const onPointerUp = () => {
    const g = drag.current;
    drag.current = null;
    if (!g) return;
    setDragging(false);
    if (!g.moved) {
      setFlipped((f) => !f);
    } else if (Math.abs(dx) >= threshold()) {
      commit(dx > 0 ? "pass" : "fail");
    } else {
      setDx(0);
    }
  };

  const offset = leaving ? (leaving === "pass" ? 1 : -1) * window.innerWidth : dx;
  const strength = leaving ? 1 : Math.min(Math.abs(dx) / threshold(), 1);
  const leaning: Result | null = leaving ?? (dx > 0 ? "pass" : dx < 0 ? "fail" : null);

  return (
    <div className="card-area">
      <div
        ref={cardRef}
        className={`card ${dragging ? "is-dragging" : ""} ${leaving ? "is-leaving" : ""}`}
        style={{ transform: `translateX(${offset}px) rotate(${offset / 22}deg)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
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
          <div className={`verdict verdict-${leaning}`} style={{ opacity: strength }} aria-hidden>
            {leaning === "pass" ? "ผ่าน" : "ไม่ผ่าน"}
          </div>
        )}
      </div>

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
        <button type="button" className="answer answer-fail" onClick={() => commit("fail")}>
          ไม่ผ่าน
        </button>
        <button type="button" className="answer answer-pass" onClick={() => commit("pass")}>
          ผ่าน
        </button>
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
