import { useEffect, useState } from "react";
import { api } from "../api";
import { WordRow } from "../components/WordRow";
import { STATUS_LABEL, TIER_ORDER, thaiDate } from "../types";
import type { Day, DayWord, Level, Status, Word } from "../types";

interface Props {
  level: Level;
  onError: (e: Error) => void;
}

const VIEWS = [
  { id: "passed", label: "ผ่านแล้ว" },
  { id: "notyet", label: "ยังไม่ผ่าน" },
  { id: "daily", label: "รายวัน" },
] as const;
type View = (typeof VIEWS)[number]["id"];

export function HistoryPage({ level, onError }: Props) {
  const [view, setView] = useState<View>("passed");
  const [words, setWords] = useState<Word[] | null>(null);
  const [days, setDays] = useState<Day[] | null>(null);
  const [tier, setTier] = useState<Status | "">("");

  useEffect(() => {
    api.words({ level }).then(setWords).catch(onError);
    api.history(level).then(setDays).catch(onError);
  }, [level]);

  const passed = (words ?? []).filter((w) => w.status !== "new");
  // Tried at least once but never passed, or passed but now frequently missed.
  const notYet = (words ?? []).filter((w) => w.progress && (w.status === "new" || w.progress.missed));
  const tiered = passed.filter((w) => !tier || w.status === tier);

  return (
    <div className="page">
      <a href="#/home" className="back">
        กลับ
      </a>
      <h2 className="page-title">ประวัติ · {level}</h2>

      <div className="segmented tabs" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            className={view === v.id ? "is-on" : ""}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {words === null || days === null ? (
        <p className="loading">กำลังโหลด</p>
      ) : view === "passed" ? (
        passed.length === 0 ? (
          <p className="empty">ยังไม่มีคำที่ท่องผ่านในระดับนี้</p>
        ) : (
          <>
            <p className="help-line">ระดับความจำดูจากจำนวนวันที่ทวนผ่าน</p>
            <div className="tier-filter" role="group" aria-label="กรองตามระดับความจำ">
              <button type="button" className={tier === "" ? "is-on" : ""} onClick={() => setTier("")}>
                ทั้งหมด {passed.length}
              </button>
              {TIER_ORDER.map((t) => {
                const n = passed.filter((w) => w.status === t).length;
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
            <ul className="word-list">
              {tiered.map((w) => (
                <WordRow key={w.id} word={w} showRounds />
              ))}
            </ul>
          </>
        )
      ) : view === "notyet" ? (
        notYet.length === 0 ? (
          <p className="empty">ไม่มีคำที่ค้างอยู่ คำที่ตอบไม่ผ่านหรือผิดบ่อยจะมาอยู่ที่นี่</p>
        ) : (
          <ul className="word-list">
            {notYet.map((w) => (
              <WordRow key={w.id} word={w} showRounds />
            ))}
          </ul>
        )
      ) : days.length === 0 ? (
        <p className="empty">ยังไม่มีประวัติการเรียน</p>
      ) : (
        <ol className="days">
          {days.map((d) => (
            <li key={d.date} className="day">
              <h3 className="day-date">{thaiDate(d.date)}</h3>
              <DayGroup label="เรียนคำใหม่" words={d.learned} />
              <DayGroup label="ทวน" words={d.reviewed} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DayGroup({ label, words }: { label: string; words: DayWord[] }) {
  if (words.length === 0) return null;
  return (
    <div className="day-group">
      <p className="day-label">
        {label} {words.length} คำ
      </p>
      <p className="day-words">
        {words.map((w) => (
          <span key={w.wordId} className={`chip ${w.fails > 0 && w.passes === 0 ? "chip-fail" : "chip-pass"}`} lang="en">
            {w.word}
          </span>
        ))}
      </p>
    </div>
  );
}
