import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { PassageView } from "../components/PassageView";
import { TYPE_LABEL } from "../reading/types";
import type { MockResult, ReadingSet, Score } from "../reading/types";
import { shuffle } from "../shuffle";

// Part 7 mock exam: every Part 7 set in order, numbered 147–200 as on the test,
// against a 55-minute clock with no feedback until it is submitted.
const PART = 7;
const FIRST_NUMBER = 147;
const LIMIT_SECONDS = 55 * 60;
const STORAGE_KEY = "toeic-mock-part7";
const LETTERS = ["A", "B", "C", "D"];
const FORMAT_LABEL: Record<string, string> = { single: "เอกสารเดี่ยว", double: "เอกสารคู่", triple: "เอกสารสามชิ้น" };

// Progress of a mock in this browser, so a reload or a closed tab can carry on.
interface Saved {
  signature: string; // which sets the attempt was built from
  startedAt: number;
  orders: string[][]; // option order per question
  answers: (string | null)[];
  setSeconds: number[];
  current: number;
  lastSwitch: number;
}

interface Item {
  setIndex: number;
  questionIndex: number;
  number: number;
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function store(s: Saved | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the attempt still works, it just can't be resumed after a reload.
  }
}

function formatOf(set: ReadingSet): string {
  return set.passages.length >= 3 ? "triple" : set.passages.length === 2 ? "double" : "single";
}

export function MockPage({ onError }: { onError: (e: Error) => void }) {
  const [sets, setSets] = useState<ReadingSet[] | null>(null);
  const [history, setHistory] = useState<MockResult[] | null>(null);
  const [attempt, setAttempt] = useState<Saved | null>(null);
  const [finished, setFinished] = useState<{ saved: Saved; result: MockResult; savedOk: boolean } | null>(null);

  useEffect(() => {
    api.readingSets(PART).then(setSets).catch(onError);
    api.mockResults(PART).then(setHistory).catch(onError);
  }, []);

  const signature = useMemo(() => (sets ? sets.map((s) => `${s.id}:${s.questions.length}`).join(",") : ""), [sets]);
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    sets?.forEach((s, si) =>
      s.questions.forEach((_, qi) => out.push({ setIndex: si, questionIndex: qi, number: FIRST_NUMBER + out.length })),
    );
    return out;
  }, [sets]);

  // Read on every render: a submitted attempt is removed from storage and must not be offered again.
  const stored = load();
  const saved = stored && stored.signature === signature ? stored : null;

  const start = () => {
    if (!sets) return;
    const now = Date.now();
    const a: Saved = {
      signature,
      startedAt: now,
      orders: items.map((it) => {
        const q = sets[it.setIndex].questions[it.questionIndex];
        return q.type === "insert" ? q.options : shuffle(q.options);
      }),
      answers: items.map(() => null),
      setSeconds: sets.map(() => 0),
      current: 0,
      lastSwitch: now,
    };
    store(a);
    setAttempt(a);
  };

  const finish = async (a: Saved) => {
    if (!sets) return;
    const now = Date.now();
    const final: Saved = {
      ...a,
      setSeconds: a.setSeconds.map((sec, i) => (i === a.current ? sec + (now - a.lastSwitch) / 1000 : sec)),
    };
    const result = score(sets, items, final, Math.min(LIMIT_SECONDS, Math.round((now - a.startedAt) / 1000)));
    store(null);
    setAttempt(null);
    let savedOk = true;
    try {
      const stored = await api.saveMockResult(result);
      setHistory((h) => [stored, ...(h ?? [])]);
    } catch (e) {
      savedOk = false;
      onError(e as Error);
    }
    setFinished({ saved: final, result, savedOk });
  };

  if (!sets || !history) return <p className="loading">กำลังโหลด</p>;
  if (finished) {
    return (
      <MockResultView
        sets={sets}
        items={items}
        attempt={finished.saved}
        result={finished.result}
        previous={finished.savedOk ? history[1] : history[0]}
        savedOk={finished.savedOk}
        onAgain={() => setFinished(null)}
      />
    );
  }
  if (attempt) return <MockExam sets={sets} items={items} attempt={attempt} onChange={setAttempt} onFinish={finish} />;

  return (
    <div className="page">
      <a href="#/reading" className="back">
        การอ่าน
      </a>
      <h2 className="page-title">ข้อสอบจำลอง Part 7</h2>
      <p className="date">
        {items.length} ข้อ ({sets.length} ชุด) ข้อ {FIRST_NUMBER}–{FIRST_NUMBER + items.length - 1} เวลา{" "}
        {LIMIT_SECONDS / 60} นาที
      </p>

      {items.length !== 54 && (
        <p className="notice">ตอนนี้ Part 7 ใน Google Sheet มี {items.length} ข้อ ข้อสอบจริงมี 54 ข้อ</p>
      )}

      <section className="strategy">
        <h3>กติกาเหมือนวันสอบ</h3>
        <ol>
          <li>นาฬิกานับถอยหลัง {LIMIT_SECONDS / 60} นาที และส่งให้อัตโนมัติเมื่อหมดเวลา ข้อที่ยังไม่ตอบนับเป็นผิด</li>
          <li>ไม่มีเฉลยระหว่างทำ เปลี่ยนคำตอบและย้อนไปชุดก่อนหน้าได้เหมือนข้อสอบจริง</li>
          <li>ถ้าเผลอปิดหน้า กลับมาที่หน้านี้แล้วทำต่อได้ แต่เวลายังเดินต่อ</li>
          <li>
            หลังส่ง จะเห็นคะแนน เวลาที่ใช้กับแต่ละรูปแบบเอกสาร ประเภทคำถามที่พลาด และเฉลยทุกข้อ ผลจะถูกบันทึกลง Google
            Sheet
          </li>
        </ol>
        <p className="analysis-note">
          ข้อสอบจริงให้เวลา 75 นาทีสำหรับ Reading ทั้งหมด (Part 5–7) ไม่ได้แบ่งเวลาแต่ละ Part ไว้ 55
          นาทีเป็นเวลาที่แนะนำกันทั่วไปสำหรับ Part 7 เพื่อให้เหลือราว 20 นาทีสำหรับ Part 5–6
          เอกสารในชุดนี้เขียนขึ้นตามรูปแบบข้อสอบ ไม่ใช่ข้อสอบจริงของ ETS
        </p>
      </section>

      {saved ? (
        <div className="actions">
          <button type="button" className="primary wide" onClick={() => setAttempt(saved)}>
            ทำต่อ (เหลือเวลา {clock(Math.max(0, LIMIT_SECONDS - (Date.now() - saved.startedAt) / 1000))})
          </button>
          <button
            type="button"
            className="secondary wide"
            onClick={() => {
              store(null);
              start();
            }}
          >
            เริ่มใหม่
          </button>
        </div>
      ) : (
        <button type="button" className="primary wide" disabled={items.length === 0} onClick={start}>
          เริ่มทำข้อสอบ
        </button>
      )}

      <section>
        <h3>ผลครั้งก่อน ๆ</h3>
        {history.length === 0 ? (
          <p className="empty">ยังไม่เคยทำ ผลแต่ละครั้งจะแสดงที่นี่</p>
        ) : (
          <table className="rules quiz-topics">
            <thead>
              <tr>
                <th scope="col">วันที่</th>
                <th scope="col">คะแนน</th>
                <th scope="col">เวลาที่ใช้</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <td>
                    {h.date} {h.time}
                  </td>
                  <td>
                    {h.correct}/{h.total}
                  </td>
                  <td>{clock(h.seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function MockExam({
  sets,
  items,
  attempt,
  onChange,
  onFinish,
}: {
  sets: ReadingSet[];
  items: Item[];
  attempt: Saved;
  onChange: (a: Saved) => void;
  onFinish: (a: Saved) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState(false);
  const finishing = useRef(false);
  const left = LIMIT_SECONDS - (now - attempt.startedAt) / 1000;

  const update = (a: Saved) => {
    store(a);
    onChange(a);
  };

  const done = (a: Saved) => {
    if (finishing.current) return;
    finishing.current = true;
    onFinish(a);
  };

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (left <= 0) done(attempt);
  }, [left <= 0]);

  // Closing the tab mid-exam asks first; the attempt itself is kept for resuming.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const goTo = (setIndex: number, number?: number) => {
    const t = Date.now();
    update({
      ...attempt,
      setSeconds: attempt.setSeconds.map((s, i) => (i === attempt.current ? s + (t - attempt.lastSwitch) / 1000 : s)),
      current: setIndex,
      lastSwitch: t,
    });
    window.setTimeout(() => {
      const el = number ? document.getElementById(`mq-${number}`) : null;
      if (el) el.scrollIntoView({ block: "center" });
      else window.scrollTo(0, 0);
    }, 0);
  };

  const answer = (k: number, option: string) =>
    update({ ...attempt, answers: attempt.answers.map((a, i) => (i === k ? option : a)) });

  const set = sets[attempt.current];
  const setItems = items.filter((it) => it.setIndex === attempt.current);
  const unanswered = attempt.answers.filter((a) => a === null).length;
  const pickedInSet = setItems.map((it) => attempt.answers[it.number - FIRST_NUMBER]);

  return (
    <div className="page reading mock">
      <header className="mock-bar">
        <div>
          <p className="mock-title">ข้อสอบจำลอง Part 7</p>
          <p className="date">
            ชุดที่ {attempt.current + 1}/{sets.length} · ตอบแล้ว {items.length - unanswered}/{items.length}
          </p>
        </div>
        <p className={`reading-clock ${left < 5 * 60 ? "is-over" : ""}`} aria-live="off">
          {clock(Math.max(0, left))}
        </p>
        <button
          type="button"
          className="secondary"
          onClick={() => (unanswered > 0 ? setConfirming(true) : done(attempt))}
        >
          ส่งคำตอบ
        </button>
      </header>

      <nav className="mock-grid" aria-label="เลขข้อ">
        {items.map((it) => {
          const answered = attempt.answers[it.number - FIRST_NUMBER] !== null;
          return (
            <button
              key={it.number}
              type="button"
              className={`${answered ? "is-answered" : ""} ${it.setIndex === attempt.current ? "is-current" : ""}`}
              aria-label={`ข้อ ${it.number}${answered ? " ตอบแล้ว" : " ยังไม่ตอบ"}`}
              onClick={() => goTo(it.setIndex, it.number)}
            >
              {it.number}
            </button>
          );
        })}
      </nav>

      <div className="reading-layout">
        <div className="passages">
          {set.passages.map((p, i) => (
            <PassageView
              key={i}
              passage={p}
              part={PART}
              picked={pickedInSet}
              questions={set.questions}
              showResult={false}
            />
          ))}
        </div>
        <div className="questions">
          {setItems.map((it) => {
            const q = set.questions[it.questionIndex];
            const k = it.number - FIRST_NUMBER;
            return (
              <div key={it.number} id={`mq-${it.number}`} className="rq">
                <p className="rq-head">
                  <span className="rq-number">{it.number}.</span>
                </p>
                <p className="rq-text" lang="en">
                  {q.question}
                </p>
                <div className="rq-options" role="radiogroup" aria-label={`ตัวเลือกข้อ ${it.number}`}>
                  {attempt.orders[k].map((o, i) => (
                    <button
                      key={o}
                      type="button"
                      role="radio"
                      aria-checked={attempt.answers[k] === o}
                      className={attempt.answers[k] === o ? "is-on" : ""}
                      onClick={() => answer(k, o)}
                    >
                      <span className="drill-letter">({LETTERS[i]})</span> <span lang="en">{o}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="mock-nav">
            <button
              type="button"
              className="secondary"
              disabled={attempt.current === 0}
              onClick={() => goTo(attempt.current - 1)}
            >
              ชุดก่อนหน้า
            </button>
            {attempt.current < sets.length - 1 ? (
              <button type="button" className="primary" onClick={() => goTo(attempt.current + 1)}>
                ชุดถัดไป
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                onClick={() => (unanswered > 0 ? setConfirming(true) : done(attempt))}
              >
                ส่งคำตอบ
              </button>
            )}
          </div>
        </div>
      </div>

      {confirming && (
        <div className="dialog-backdrop" onClick={() => setConfirming(false)}>
          <div
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mock-confirm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="mock-confirm">ส่งคำตอบตอนนี้?</h2>
            <p>
              ยังไม่ได้ตอบ {unanswered} ข้อ ข้อที่ไม่ได้ตอบจะนับเป็นผิด ในข้อสอบจริงไม่มีการหักคะแนนเมื่อตอบผิด
              จึงควรเดาให้ครบทุกข้อก่อนส่ง
            </p>
            <div className="dialog-actions">
              <button type="button" className="primary" onClick={() => setConfirming(false)}>
                กลับไปทำต่อ
              </button>
              <button type="button" className="secondary danger" onClick={() => done(attempt)}>
                ส่งเลย
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function score(sets: ReadingSet[], items: Item[], a: Saved, seconds: number): MockResult {
  const byType: Record<string, Score> = {};
  const byFormat: Record<string, Score> = {};
  let correct = 0;
  items.forEach((it, k) => {
    const set = sets[it.setIndex];
    const q = set.questions[it.questionIndex];
    const ok = a.answers[k] === q.answer;
    if (ok) correct++;
    for (const [bucket, key] of [
      [byType, q.type],
      [byFormat, formatOf(set)],
    ] as const) {
      bucket[key] ??= { correct: 0, total: 0 };
      bucket[key].total++;
      if (ok) bucket[key].correct++;
    }
  });
  return {
    part: PART,
    correct,
    total: items.length,
    seconds,
    limit: LIMIT_SECONDS,
    byType,
    byFormat,
    date: "",
    time: "",
  };
}

function MockResultView({
  sets,
  items,
  attempt,
  result,
  previous,
  savedOk,
  onAgain,
}: {
  sets: ReadingSet[];
  items: Item[];
  attempt: Saved;
  result: MockResult;
  previous: MockResult | undefined;
  savedOk: boolean;
  onAgain: () => void;
}) {
  const [onlyWrong, setOnlyWrong] = useState(true);
  const unanswered = attempt.answers.filter((a) => a === null).length;

  // Time per format against the test's pace of about a minute a question.
  const formats = ["single", "double", "triple"].map((f) => {
    const idx = sets.map((s, i) => (formatOf(s) === f ? i : -1)).filter((i) => i >= 0);
    const questions = idx.reduce((n, i) => n + sets[i].questions.length, 0);
    const seconds = idx.reduce((n, i) => n + attempt.setSeconds[i], 0);
    return { f, questions, seconds, score: result.byFormat[f] };
  });
  const types = Object.entries(result.byType).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total);

  return (
    <div className="page">
      <a href="#/reading" className="back">
        การอ่าน
      </a>
      <h2 className="page-title">ผลข้อสอบจำลอง Part 7</h2>

      <div className="quiz-figures">
        <div>
          <p className="quiz-score">
            {result.correct}/{result.total}
          </p>
          <p className="figure-label">คะแนน ({Math.round((result.correct / result.total) * 100)}%)</p>
        </div>
        <div>
          <p className="quiz-score">{clock(result.seconds)}</p>
          <p className="figure-label">เวลาที่ใช้ จาก {clock(result.limit)}</p>
        </div>
        {previous && (
          <div>
            <p className="quiz-score">
              {result.correct - previous.correct >= 0 ? "+" : ""}
              {result.correct - previous.correct}
            </p>
            <p className="figure-label">
              เทียบครั้งก่อน ({previous.correct}/{previous.total})
            </p>
          </div>
        )}
      </div>

      {unanswered > 0 && (
        <p className="notice">
          ไม่ได้ตอบ {unanswered} ข้อ ถ้าเป็นข้อสอบจริง การเดาให้ครบทุกข้อจะได้คะแนนเพิ่มโดยเฉลี่ยราว 1 ใน 4 ของข้อที่เดา
        </p>
      )}
      {!savedOk && <p className="notice">บันทึกผลลง Google Sheet ไม่สำเร็จ ผลครั้งนี้จึงไม่อยู่ในประวัติ</p>}

      <section>
        <h3>แยกตามรูปแบบเอกสาร</h3>
        <table className="rules quiz-topics">
          <thead>
            <tr>
              <th scope="col">รูปแบบ</th>
              <th scope="col">ถูก</th>
              <th scope="col">เวลาที่ใช้ / ควรใช้</th>
            </tr>
          </thead>
          <tbody>
            {formats
              .filter((r) => r.questions > 0)
              .map((r) => (
                <tr key={r.f}>
                  <td>{FORMAT_LABEL[r.f]}</td>
                  <td className={r.score && r.score.correct < r.score.total ? "is-weak" : ""}>
                    {r.score?.correct ?? 0}/{r.score?.total ?? 0}
                  </td>
                  <td className={r.seconds > r.questions * 60 ? "is-weak" : ""}>
                    {clock(Math.round(r.seconds))} / {clock(r.questions * 60)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>แยกตามประเภทคำถาม (อ่อนสุดอยู่บน)</h3>
        <table className="rules quiz-topics">
          <tbody>
            {types.map(([t, s]) => (
              <tr key={t}>
                <td>{TYPE_LABEL[t] ?? t}</td>
                <td className={s.correct < s.total ? "is-weak" : ""}>
                  {s.correct}/{s.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>ทวนเฉลย</h3>
        <div className="segmented small" role="radiogroup" aria-label="ข้อที่แสดง">
          <button
            type="button"
            role="radio"
            aria-checked={onlyWrong}
            className={onlyWrong ? "is-on" : ""}
            onClick={() => setOnlyWrong(true)}
          >
            เฉพาะข้อที่ผิด
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!onlyWrong}
            className={!onlyWrong ? "is-on" : ""}
            onClick={() => setOnlyWrong(false)}
          >
            ทุกข้อ
          </button>
        </div>
        <div className="mock-review">
          {sets.map((set, si) => {
            const its = items.filter((it) => it.setIndex === si);
            const shown = its.filter(
              (it) =>
                !onlyWrong || attempt.answers[it.number - FIRST_NUMBER] !== set.questions[it.questionIndex].answer,
            );
            if (shown.length === 0) return null;
            return (
              <div key={set.id} className="mock-review-set">
                <p className="analysis-label">
                  ข้อ {its[0].number}–{its[its.length - 1].number}: {set.title}
                </p>
                <details>
                  <summary>ดูเอกสาร</summary>
                  <div className="passages">
                    {set.passages.map((p, i) => (
                      <PassageView key={i} passage={p} part={PART} picked={[]} questions={set.questions} />
                    ))}
                  </div>
                </details>
                {shown.map((it) => {
                  const q = set.questions[it.questionIndex];
                  const mine = attempt.answers[it.number - FIRST_NUMBER];
                  const ok = mine === q.answer;
                  return (
                    <div key={it.number} className="rq">
                      <p className="rq-head">
                        <span className="rq-number">{it.number}.</span>
                        <span className="rq-type">{TYPE_LABEL[q.type] ?? q.type}</span>
                      </p>
                      <p className="rq-text" lang="en">
                        {q.question}
                      </p>
                      <p className="mock-answer">
                        คำตอบของคุณ: <strong lang="en">{mine ?? "ไม่ได้ตอบ"}</strong>
                        {!ok && (
                          <>
                            {" "}
                            · คำตอบที่ถูก: <strong lang="en">{q.answer}</strong>
                          </>
                        )}
                      </p>
                      <p className={`drill-why ${ok ? "is-pass" : "is-fail"}`}>{q.why}</p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      <div className="quiz-actions">
        <button type="button" className="primary" onClick={onAgain}>
          กลับหน้าข้อสอบจำลอง
        </button>
        <a className="secondary link-button" href="#/reading">
          ฝึกทีละชุด
        </a>
      </div>
    </div>
  );
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
