import { useEffect, useState } from "react";
import { api } from "../api";
import type { SessionSpec } from "../components/Session";
import { WordRow } from "../components/WordRow";
import type { Level, Word } from "../types";

interface Props {
  level: Level;
  onStart: (s: SessionSpec) => void;
  onError: (e: Error) => void;
}

const DECKS = [
  { id: "learned", label: "คำที่ท่องแล้ว", empty: "ยังไม่มีคำที่ท่องผ่านในระดับนี้ เริ่มจากท่องศัพท์ใหม่ได้เลย" },
  { id: "missed", label: "ผิดบ่อย", empty: "ยังไม่มีคำที่ผิดบ่อย คำที่ไม่ผ่าน 3 ใน 5 ครั้งล่าสุดจะมาอยู่ที่นี่" },
  { id: "favorites", label: "คำโปรด", empty: "ยังไม่มีคำโปรด กดเก็บเป็นคำโปรดได้ระหว่างท่อง" },
] as const;

// Groups by how many times a word has been answered so far.
const ROUNDS = [
  { id: "1-2", label: "1–2 รอบ", min: 1, max: 2 },
  { id: "3-5", label: "3–5 รอบ", min: 3, max: 5 },
  { id: "6-9", label: "6–9 รอบ", min: 6, max: 9 },
  { id: "10+", label: "10 รอบขึ้นไป", min: 10, max: Infinity },
] as const;

const SIZES = [10, 20, 30];

export function ReviewPage({ level, onStart, onError }: Props) {
  const [deck, setDeck] = useState<(typeof DECKS)[number]["id"]>("learned");
  const [rounds, setRounds] = useState<string>("");
  const [size, setSize] = useState(20);
  const [words, setWords] = useState<Word[] | null>(null);

  useEffect(() => {
    setWords(null);
    api.words({ deck, level }).then(setWords).catch(onError);
  }, [deck, level]);

  const info = DECKS.find((d) => d.id === deck)!;
  const count = (w: Word) => w.progress?.reviewCount ?? 0;
  const band = ROUNDS.find((r) => r.id === rounds);
  const shown = (words ?? []).filter((w) => !band || (count(w) >= band.min && count(w) <= band.max));
  const practice = shown.slice(0, size);

  return (
    <div className="page">
      <a href="#/home" className="back">
        กลับ
      </a>
      <h2 className="page-title">ทวนศัพท์เก่า · {level}</h2>

      <div className="segmented tabs" role="tablist">
        {DECKS.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={deck === d.id}
            className={deck === d.id ? "is-on" : ""}
            onClick={() => {
              setDeck(d.id);
              setRounds("");
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {words && words.length > 0 && (
        <section>
          <h3>เลือกคำที่ทวนมาแล้วกี่รอบ</h3>
          <div className="tier-filter" role="group" aria-label="จำนวนรอบที่ทวน">
            <button type="button" className={rounds === "" ? "is-on" : ""} onClick={() => setRounds("")}>
              ทั้งหมด {words.length}
            </button>
            {ROUNDS.map((r) => {
              const n = words.filter((w) => count(w) >= r.min && count(w) <= r.max).length;
              return (
                <button
                  key={r.id}
                  type="button"
                  className={rounds === r.id ? "is-on" : ""}
                  disabled={n === 0}
                  onClick={() => setRounds(r.id)}
                >
                  {r.label} {n}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {words === null ? (
        <p className="loading">กำลังโหลด</p>
      ) : shown.length === 0 ? (
        <p className="empty">{info.empty}</p>
      ) : (
        <>
          <section>
            <h3>จำนวนคำในรอบนี้</h3>
            <div className="segmented small" role="radiogroup" aria-label="จำนวนคำในรอบนี้">
              {SIZES.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={size === n}
                  className={size === n ? "is-on" : ""}
                  onClick={() => setSize(n)}
                >
                  {n} คำ
                </button>
              ))}
            </div>
          </section>
          <button
            type="button"
            className="primary wide"
            onClick={() => onStart({ title: `ทวน ${level}`, mode: "review", words: practice })}
          >
            ทวน {practice.length} คำที่ใกล้ลืมที่สุด
          </button>
          <ul className="word-list">
            {shown.map((w) => (
              <WordRow key={w.id} word={w} showRounds />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
