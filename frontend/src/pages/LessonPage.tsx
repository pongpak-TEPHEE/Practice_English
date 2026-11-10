import { useMemo, useState } from "react";
import { speak } from "../audio";
import { Drill } from "../components/Drill";
import { findLesson } from "../grammar";
import { shuffle } from "../shuffle";
import type { Drill as DrillData, Example, Lesson } from "../grammar/types";
import type { Accent } from "../types";

const QUIZ_SIZE = 10;

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

      <div className="split">
        <nav className="split-side lesson-toc" aria-label="หัวข้อในบทเรียน">
          <h3>หัวข้อ</h3>
          <ol>
            {lesson.sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#/grammar/${lesson.id}`} onClick={(e) => jump(e, s.id)}>
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
            <li>
              <a href={`#/grammar/${lesson.id}`} onClick={(e) => jump(e, "quiz")}>
                แบบฝึกรวม
              </a>
            </li>
          </ol>
        </nav>

        <div className="split-main lesson-body">
          {lesson.sections.map((s, i) => (
            <section key={s.id} id={`sec-${s.id}`} className="lesson-section">
              <h2>
                {i + 1}. {s.title}
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

              <h3>ลองทำ</h3>
              <div className="drills">
                {s.drills.map((d, n) => (
                  <Drill key={d.sentence} drill={d} number={n + 1} />
                ))}
              </div>
            </section>
          ))}

          <section id="sec-quiz" className="lesson-section">
            <h2>แบบฝึกรวม</h2>
            <p className="lesson-intro">สุ่ม {QUIZ_SIZE} ข้อจากทุกหัวข้อในบทนี้ ทำต่อกันทีละข้อแล้วดูคะแนนตอนจบ</p>
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

function Quiz({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const [round, setRound] = useState(0);
  const questions = useMemo<DrillData[]>(
    () => shuffle(lesson.sections.flatMap((s) => s.drills)).slice(0, QUIZ_SIZE),
    [lesson, round],
  );
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const done = index >= questions.length;

  const restart = () => {
    setRound((r) => r + 1);
    setIndex(0);
    setScore(0);
    setAnswered(false);
  };

  if (done) {
    return (
      <div className="quiz-end">
        <p className="quiz-score">
          {score}/{questions.length}
        </p>
        <p>
          {score === questions.length
            ? "ถูกทุกข้อ"
            : `ผิด ${questions.length - score} ข้อ ลองย้อนไปอ่านหัวข้อที่พลาดแล้วทำใหม่ได้`}
        </p>
        <div className="quiz-actions">
          <button type="button" className="primary" onClick={restart}>
            ทำอีกรอบ
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz">
      <p className="quiz-progress">
        ข้อ {index + 1} จาก {questions.length} · ถูก {score}
      </p>
      <div className="meter" aria-hidden>
        <span style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>
      <Drill
        key={`${round}-${index}`}
        drill={questions[index]}
        onAnswered={(ok) => {
          setAnswered(true);
          if (ok) setScore((s) => s + 1);
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
        {index + 1 === questions.length ? "ดูคะแนน" : "ข้อต่อไป"}
      </button>
    </div>
  );
}
