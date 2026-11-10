import { useEffect, useState } from "react";
import { api } from "../api";
import { KIND_LABEL } from "../reading/types";
import type { ReadingGuide, ReadingOverview } from "../reading/types";

export function ReadingPage({ onError }: { onError: (e: Error) => void }) {
  const [data, setData] = useState<ReadingOverview | null>(null);
  const [part, setPart] = useState(7);

  useEffect(() => {
    api.reading().then(setData).catch(onError);
  }, []);

  const guide = data?.guides.find((g) => g.part === part);
  const sets = (data?.sets ?? []).filter((s) => s.part === part);

  return (
    <div className="page">
      <a href="#/home" className="back">
        หน้าแรก
      </a>
      <h2 className="page-title">การอ่าน</h2>
      <p className="date">ฝึก Reading Part 6 และ Part 7 ด้วยข้อความแนวธุรกิจที่เขียนตามรูปแบบข้อสอบ พร้อมจับเวลา</p>

      <div className="segmented tabs" role="tablist">
        {[6, 7].map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={part === p}
            className={part === p ? "is-on" : ""}
            onClick={() => setPart(p)}
          >
            Part {p}
          </button>
        ))}
      </div>

      {data === null ? (
        <p className="loading">กำลังโหลด</p>
      ) : (
        <>
          {guide && <Guide guide={guide} />}
          <section>
            <h3>ชุดฝึก</h3>
            {sets.length === 0 ? (
              <p className="empty">ยังไม่มีชุดฝึกของ Part {part} เพิ่มได้ในแท็บ reading_sets ของ Google Sheet</p>
            ) : (
              <nav className="activities">
                {sets.map((s) => (
                  <a key={s.id} href={`#/reading/${s.id}`} className="activity activity-reading">
                    <span className="activity-title">{s.title}</span>
                    <span className="activity-note">
                      {s.kinds.map((k) => KIND_LABEL[k] ?? k).join(" + ")} · {s.questions} ข้อ
                    </span>
                  </a>
                ))}
              </nav>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Guide({ guide }: { guide: ReadingGuide }) {
  const a = guide.analysis;
  return (
    <div className="lesson-overview">
      <section className="analysis" aria-labelledby="reading-analysis">
        <h3 id="reading-analysis">{guide.title}: ช่วยคะแนนแค่ไหน</h3>
        <dl className="analysis-facts">
          <div>
            <dt>ออกใน</dt>
            <dd>{a.parts}</dd>
          </div>
          <div>
            <dt>จำนวนข้อ</dt>
            <dd>{a.questions}</dd>
          </div>
          <div>
            <dt>คิดเป็นคะแนน</dt>
            <dd>{a.points}</dd>
          </div>
        </dl>
        <div className="analysis-lists">
          <div>
            <p className="analysis-label">ส่วนนี้ครอบคลุม</p>
            <ul>
              {a.covers.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="analysis-label">ยังไม่ครอบคลุม</p>
            <ul>
              {a.notCovered.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="analysis-note">{a.note}</p>
      </section>

      <section className="strategy" aria-labelledby="reading-strategy">
        <h3 id="reading-strategy">วิธีทำข้อสอบ</h3>
        <ol>
          {guide.strategy.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="analysis-label">ประเภทคำถาม</p>
        <dl className="qtypes">
          {guide.questionTypes.map((t) => (
            <div key={t.name}>
              <dt>{t.name}</dt>
              <dd>{t.how}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
