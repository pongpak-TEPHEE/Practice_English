import { useEffect, useState } from "react";
import { api } from "../api";
import { WordRow } from "../components/WordRow";
import { LEVELS, STATUS_LABEL, TIER_ORDER } from "../types";
import type { Level, Stats, Word } from "../types";

const SHOW_LIMIT = 60;

export function WordsPage({ onError }: { onError: (e: Error) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [level, setLevel] = useState<Level | "">("");
  const [q, setQ] = useState("");
  const [words, setWords] = useState<Word[] | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(onError);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      api.words({ level, q }).then(setWords).catch(onError);
    }, 200);
    return () => window.clearTimeout(t);
  }, [level, q]);

  return (
    <div className="page">
      <h2 className="page-title">คำศัพท์ทั้งหมด</h2>
      <div className="split">
        <div className="split-side">
          {stats && (
            <section className="levels" aria-label="ความคืบหน้าแต่ละระดับ">
              {stats.byLevel.map((l) => {
                const learned = l.total - l.new;
                return (
                  <div key={l.level} className="level-stat">
                    <p className="level-stat-head">
                      <span className="level-name">{l.level}</span>
                      <span>
                        ท่องแล้ว {learned} จาก {l.total} คำ
                      </span>
                    </p>
                    <div className="stack" aria-hidden>
                      {TIER_ORDER.map((t) => (
                        <span key={t} className={`tier-${t}`} style={{ width: `${(l[t] / l.total) * 100}%` }} />
                      ))}
                    </div>
                  </div>
                );
              })}
              <p className="legend">
                {TIER_ORDER.map((t) => (
                  <span key={t} className={`legend-item tier-${t}`}>
                    {STATUS_LABEL[t]} {stats[t]}
                  </span>
                ))}
              </p>
            </section>
          )}

          <section className="search">
            <input
              type="search"
              inputMode="search"
              placeholder="ค้นหาคำศัพท์หรือคำแปล"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="ค้นหาคำศัพท์หรือคำแปล"
            />
            <div className="segmented small" role="radiogroup" aria-label="ระดับ">
              {(["", ...LEVELS] as const).map((l) => (
                <button
                  key={l || "all"}
                  type="button"
                  role="radio"
                  aria-checked={level === l}
                  className={level === l ? "is-on" : ""}
                  onClick={() => setLevel(l)}
                >
                  {l || "ทุกระดับ"}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="split-main">
          {words === null ? (
            <p className="loading">กำลังโหลด</p>
          ) : words.length === 0 ? (
            <p className="empty">ไม่พบคำที่ตรงกับ "{q}"</p>
          ) : (
            <>
              <ul className="word-list">
                {words.slice(0, SHOW_LIMIT).map((w) => (
                  <WordRow key={w.id} word={w} />
                ))}
              </ul>
              {words.length > SHOW_LIMIT && (
                <p className="empty">
                  แสดง {SHOW_LIMIT} จาก {words.length} คำ พิมพ์ค้นหาเพื่อหาคำที่ต้องการ
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
