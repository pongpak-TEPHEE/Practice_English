import { useEffect, useMemo, useRef, useState } from "react";
import { speak } from "../audio";
import { Drill } from "../components/Drill";
import { findLesson } from "../grammar";
import type { Drill as DrillData, Example, Lesson, Priority } from "../grammar/types";
import { shuffle } from "../shuffle";
import type { Accent } from "../types";

const QUIZ_SIZE = 10;
const TARGET_SECONDS = 20; // Part 5 pace that leaves enough time for Part 7

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "ออกบ่อย",
  medium: "ออกพอสมควร",
  basic: "พื้นฐาน",
};

export function LessonPage({ id, accent }: { id: string; accent: Accent }) {
  const lesson = findLesson(id);
  const [quiz, setQuiz] = useState(false);

  if (!lesson) {
    return (
      <div className="page">
        <a href="#/grammar" className="back">
          ไวยากรณ์
        </a>
        <p className="empty">ไม่พบบทเรียนนี้ เลือกบทเรียนจากหน้าไวยากรณ์ได้เลย</p>
      </div>
    );
  }

  const a = lesson.analysis;

  return (
    <div className="page lesson">
      <a href="#/grammar" className="back">
        ไวยากรณ์
      </a>
      <header>
        <h2 className="page-title">
          {lesson.title} <span className="activity-en">{lesson.english}</span>
        </h2>
        <p className="date">{lesson.summary}</p>
      </header>

      <div className="lesson-overview">
        <section className="analysis" aria-labelledby="analysis-title">
          <h3 id="analysis-title">บทนี้ช่วยคะแนนแค่ไหน</h3>
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
              <p className="analysis-label">บทนี้ครอบคลุม</p>
              <ul>
                {a.covers.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="analysis-label">ยังไม่ครอบคลุม (ต้องเรียนบทอื่น)</p>
              <ul>
                {a.notCovered.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="analysis-note">{a.note}</p>
        </section>

        <section className="strategy" aria-labelledby="strategy-title">
          <h3 id="strategy-title">วิธีทำข้อสอบแบบนี้</h3>
          <ol>
            {lesson.strategy.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      </div>

      <div className="split">
        <nav className="split-side lesson-toc" aria-label="หัวข้อในบทเรียน">
          <h3>หัวข้อ เรียงตามความถี่ที่ออกสอบ</h3>
          <ol>
            {lesson.sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#/grammar/${lesson.id}`} onClick={(e) => jump(e, s.id)}>
                  <span>
                    {i + 1}. {s.title}
                  </span>
                  <span className={`priority priority-${s.priority}`}>{PRIORITY_LABEL[s.priority]}</span>
                </a>
              </li>
            ))}
            <li>
              <a href={`#/grammar/${lesson.id}`} onClick={(e) => jump(e, "quiz")}>
                <span>แบบฝึกรวมจับเวลา</span>
              </a>
            </li>
          </ol>
        </nav>

        <div className="split-main lesson-body">
          {lesson.sections.map((s, i) => (
            <section key={s.id} id={`sec-${s.id}`} className="lesson-section">
              <h2>
                {i + 1}. {s.title}{" "}
                <span className={`priority priority-${s.priority}`}>{PRIORITY_LABEL[s.priority]}</span>
              </h2>
              <p className="lesson-intro">{s.intro}</p>

              <table className="rules">
                <thead>
                  <tr>
                    <th scope="col">คำ</th>
                    <th scope="col">ใช้เมื่อ</th>
                    <th scope="col">ตัวอย่าง</th>
                  </tr>
                </thead>
                <tbody>
                  {s.rules.map((r) => (
                    <tr key={r.word}>
                      <th scope="row" lang="en">
                        {r.word}
                      </th>
                      <td>{r.use}</td>
                      <td lang="en">{r.examples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>ตัวอย่างประโยค</h3>
              <ul className="examples">
                {s.examples.map((ex) => (
                  <ExampleRow key={ex.en} ex={ex} accent={accent} />
                ))}
              </ul>

              {s.tip && (
                <p className="tip">
                  <strong>จุดที่มักพลาด</strong> {s.tip}
                </p>
              )}

              <h3>ลองทำแบบ Part 5</h3>
              <div className="drills">
                {s.drills.map((d, n) => (
                  <Drill key={d.sentence} drill={d} number={n + 1} />
                ))}
              </div>
            </section>
          ))}

          <section id="sec-quiz" className="lesson-section">
            <h2>แบบฝึกรวมจับเวลา</h2>
            <p className="lesson-intro">
              สุ่ม {QUIZ_SIZE} ข้อจากทุกหัวข้อ ทำต่อกันทีละข้อเหมือน Part 5 จริง พยายามตอบให้ได้ภายใน {TARGET_SECONDS}{" "}
              วินาทีต่อข้อ ตอนจบจะบอกคะแนน เวลาเฉลี่ย และหัวข้อที่ควรทวน
            </p>
            {quiz ? (
              <Quiz lesson={lesson} onClose={() => setQuiz(false)} />
            ) : (
              <button type="button" className="primary" onClick={() => setQuiz(true)}>
                เริ่มแบบฝึกรวม
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// In-page jump that leaves the hash route alone.
function jump(e: React.MouseEvent, id: string) {
  e.preventDefault();
  document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ExampleRow({ ex, accent }: { ex: Example; accent: Accent }) {
  const at = ex.en.toLowerCase().indexOf(ex.mark.toLowerCase());
  return (
    <li className="example-row">
      <div>
        <p className="example-en" lang="en">
          {at < 0 ? (
            ex.en
          ) : (
            <>
              {ex.en.slice(0, at)}
              <strong>{ex.en.slice(at, at + ex.mark.length)}</strong>
              {ex.en.slice(at + ex.mark.length)}
            </>
          )}
        </p>
        <p className="example-th">{ex.th}</p>
      </div>
      <button type="button" className="text-btn" onClick={() => speak(ex.en, accent)}>
        ฟัง
      </button>
    </li>
  );
}

interface Question {
  drill: DrillData;
  sectionId: string;
  sectionTitle: string;
}

interface Result {
  sectionId: string;
  sectionTitle: string;
  correct: boolean;
  seconds: number;
}

function Quiz({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const [round, setRound] = useState(0);
  const questions = useMemo<Question[]>(
    () =>
      shuffle(
        lesson.sections.flatMap((s) => s.drills.map((drill) => ({ drill, sectionId: s.id, sectionTitle: s.title }))),
      ).slice(0, QUIZ_SIZE),
    [lesson, round],
  );
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [answered, setAnswered] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  const done = index >= questions.length;

  // A visible clock per question, like the pressure of the real test.
  useEffect(() => {
    startedAt.current = Date.now();
    setElapsed(0);
    if (done) return;
    const t = window.setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 250);
    return () => window.clearInterval(t);
  }, [index, round, done]);

  const restart = () => {
    setRound((r) => r + 1);
    setIndex(0);
    setResults([]);
    setAnswered(false);
  };

  if (done) return <QuizResult results={results} onRestart={restart} onClose={onClose} />;

  const q = questions[index];
  const correctSoFar = results.filter((r) => r.correct).length;
  const shownSeconds = answered ? (results.at(-1)?.seconds ?? elapsed) : elapsed;

  return (
    <div className="quiz">
      <div className="quiz-head">
        <span>
          ข้อ {index + 1} จาก {questions.length} · ถูก {correctSoFar}
        </span>
        <span className={`quiz-clock ${shownSeconds > TARGET_SECONDS ? "is-over" : ""}`} aria-live="off">
          {Math.floor(shownSeconds)} วินาที
        </span>
      </div>
      <div className="meter" aria-hidden>
        <span style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>
      <Drill
        key={`${round}-${index}`}
        drill={q.drill}
        onAnswered={(ok) => {
          const seconds = (Date.now() - startedAt.current) / 1000;
          setAnswered(true);
          setResults((r) => [...r, { sectionId: q.sectionId, sectionTitle: q.sectionTitle, correct: ok, seconds }]);
        }}
      />
      <button
        type="button"
        className="primary"
        disabled={!answered}
        onClick={() => {
          setIndex((i) => i + 1);
          setAnswered(false);
        }}
      >
        {index + 1 === questions.length ? "ดูผล" : "ข้อต่อไป"}
      </button>
    </div>
  );
}

function QuizResult({
  results,
  onRestart,
  onClose,
}: {
  results: Result[];
  onRestart: () => void;
  onClose: () => void;
}) {
  const score = results.filter((r) => r.correct).length;
  const avg = results.reduce((n, r) => n + r.seconds, 0) / Math.max(results.length, 1);
  const slow = results.filter((r) => r.seconds > TARGET_SECONDS).length;

  // Per topic, weakest first, so the next step is obvious.
  const topics = new Map<string, { title: string; right: number; total: number }>();
  for (const r of results) {
    const t = topics.get(r.sectionId) ?? { title: r.sectionTitle, right: 0, total: 0 };
    t.total++;
    if (r.correct) t.right++;
    topics.set(r.sectionId, t);
  }
  const byTopic = [...topics.entries()].sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total);
  const weak = byTopic.filter(([, t]) => t.right < t.total);

  return (
    <div className="quiz-end">
      <div className="quiz-figures">
        <div>
          <p className="quiz-score">
            {score}/{results.length}
          </p>
          <p className="figure-label">คะแนน</p>
        </div>
        <div>
          <p className={`quiz-score ${avg > TARGET_SECONDS ? "is-over" : ""}`}>{avg.toFixed(1)}</p>
          <p className="figure-label">วินาทีต่อข้อ (เป้า {TARGET_SECONDS})</p>
        </div>
      </div>

      <p>
        {score === results.length ? "ถูกทุกข้อ " : `ผิด ${results.length - score} ข้อ `}
        {slow === 0
          ? "และทำทันเวลาทุกข้อ"
          : `ใช้เวลาเกิน ${TARGET_SECONDS} วินาที ${slow} ข้อ ในการสอบจริงข้อที่ช้าจะไปกินเวลาของ Part 7`}
      </p>

      <table className="rules quiz-topics">
        <thead>
          <tr>
            <th scope="col">หัวข้อ</th>
            <th scope="col">ถูก</th>
          </tr>
        </thead>
        <tbody>
          {byTopic.map(([id, t]) => (
            <tr key={id}>
              <td>
                <a href="#" onClick={(e) => jump(e, id)}>
                  {t.title}
                </a>
              </td>
              <td className={t.right < t.total ? "is-weak" : ""}>
                {t.right}/{t.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {weak.length > 0 && <p className="tip">ควรทวน: {weak.map(([, t]) => t.title).join(", ")}</p>}

      <div className="quiz-actions">
        <button type="button" className="primary" onClick={onRestart}>
          ทำอีกรอบ
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          ปิด
        </button>
      </div>
    </div>
  );
}
