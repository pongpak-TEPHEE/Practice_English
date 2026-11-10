import { useEffect, useState } from "react";
import { api } from "../api";
import type { SessionSpec } from "../components/Session";
import { WordRow } from "../components/WordRow";
import { STATUS_LABEL, TIER_ORDER } from "../types";
import type { Status, Word } from "../types";

interface Props {
  onStart: (s: SessionSpec) => void;
  onError: (e: Error) => void;
}

const DECKS = [
  { id: "learned", label: "คำที่ท่องแล้ว", empty: "ยังไม่มีคำที่ท่องผ่าน เริ่มจากหน้าวันนี้ได้เลย" },
  { id: "missed", label: "ผิดบ่อย", empty: "ยังไม่มีคำที่ผิดบ่อย คำที่ไม่ผ่าน 3 ใน 5 ครั้งล่าสุดจะมาอยู่ที่นี่" },
  { id: "favorites", label: "คำโปรด", empty: "ยังไม่มีคำโปรด กดเก็บเป็นคำโปรดได้ระหว่างท่อง" },
] as const;

const PRACTICE_SIZE = 20;

export function ReviewPage({ onStart, onError }: Props) {
  const [deck, setDeck] = useState<(typeof DECKS)[number]["id"]>("learned");
  const [tier, setTier] = useState<Status | "">("");
  const [words, setWords] = useState<Word[] | null>(null);

  useEffect(() => {
    setWords(null);
    api.words({ deck }).then(setWords).catch(onError);
  }, [deck]);

  const info = DECKS.find((d) => d.id === deck)!;
  const shown = (words ?? []).filter((w) => !tier || w.status === tier);
  const practice = shown.slice(0, PRACTICE_SIZE);

  return (
    <div className="page">
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
              setTier("");
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {words && words.length > 0 && (
        <div className="tier-filter" role="group" aria-label="กรองตามความเชี่ยวชาญ">
          <button type="button" className={tier === "" ? "is-on" : ""} onClick={() => setTier("")}>
            ทั้งหมด {words.length}
          </button>
          {TIER_ORDER.map((t) => {
            const n = words.filter((w) => w.status === t).length;
            return (
              <button
                key={t}
                type="button"
                className={`tier-${t} ${tier === t ? "is-on" : ""}`}
                disabled={n === 0}
                onClick={() => setTier(t)}
              >
                {STATUS_LABEL[t]} {n}
              </button>
            );
          })}
        </div>
      )}

      {words === null ? (
        <p className="loading">กำลังโหลด</p>
      ) : shown.length === 0 ? (
        <p className="empty">{info.empty}</p>
      ) : (
        <>
          <button
            type="button"
            className="primary wide"
            onClick={() => onStart({ title: info.label, mode: "review", words: practice })}
          >
            ทวน {practice.length} คำที่ใกล้ลืมที่สุด
          </button>
          <ul className="word-list">
            {shown.map((w) => (
              <WordRow key={w.id} word={w} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
