import { Fragment, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import { KIND_LABEL, TYPE_LABEL, targetSeconds } from "../reading/types";
import type { Passage, Question, ReadingSet } from "../reading/types";
import { shuffle } from "../shuffle";

const LETTERS = ["A", "B", "C", "D"];

interface Props {
  id: string;
  onError: (e: Error) => void;
}

export function ReadingSetPage({ id, onError }: Props) {
  const [set, setSet] = useState<ReadingSet | null | undefined>(undefined); // null = not found

  useEffect(() => {
    api
      .readingSet(id)
      .then(setSet)
      .catch((e: Error) => {
        if (e instanceof ApiError && e.status === 404) setSet(null);
        else onError(e);
      });
  }, [id]);

  if (set === undefined) return <p className="loading">กำลังโหลด</p>;
  if (set === null) {
    return (
      <div className="page">
        <a href="#/reading" className="back">
          การอ่าน
        </a>
        <p className="empty">ไม่พบชุดฝึกนี้ เลือกชุดฝึกจากหน้าการอ่านได้เลย</p>
      </div>
    );
  }
  return <Practice key={set.id} set={set} />;
}

function Practice({ set }: { set: ReadingSet }) {
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<(string | null)[]>(() => set.questions.map(() => null));
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  // Options are shuffled so the answer's position gives nothing away, except
  // insertion questions whose options are positions [1]..[4] in order.
  const options = useMemo(
    () => set.questions.map((q) => (q.type === "insert" ? q.options : shuffle(q.options))),
    [set, round],
  );

  const done = picked.every((p) => p !== null);
  useEffect(() => {
    if (done) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [done]);

  const pick = (i: number, option: string) => {
    if (picked[i] !== null) return;
    const next = picked.map((p, k) => (k === i ? option : p));
    setPicked(next);
    if (next.every((p) => p !== null)) setFinishedAt(Date.now());
  };

  const restart = () => {
    setRound((r) => r + 1);
    setPicked(set.questions.map(() => null));
    setStartedAt(Date.now());
    setNow(Date.now());
    setFinishedAt(null);
  };

  const elapsed = Math.round(((finishedAt ?? now) - startedAt) / 1000);
  const target = targetSeconds(set.part, set.questions.length);

  return (
    <div className="page reading">
      <a href="#/reading" className="back">
        การอ่าน
      </a>
      <header className="reading-head">
        <div>
          <h2 className="page-title">{set.title}</h2>
          <p className="date">
            Part {set.part} · {set.questions.length} ข้อ · เวลาที่ควรใช้ {clock(target)}
          </p>
        </div>
        <p className={`reading-clock ${elapsed > target ? "is-over" : ""}`} aria-live="off">
          {clock(elapsed)}
        </p>
      </header>

      <div className="reading-layout">
        <div className="passages">
          {set.passages.map((p, i) => (
            <PassageView key={i} passage={p} part={set.part} picked={picked} questions={set.questions} />
          ))}
        </div>

        <div className="questions">
          {set.questions.map((q, i) => (
            <QuestionView
              key={`${round}-${i}`}
              number={i + 1}
              question={q}
              options={options[i]}
              picked={picked[i]}
              onPick={(o) => pick(i, o)}
            />
          ))}
          {done && <Result set={set} picked={picked} elapsed={elapsed} target={target} onRestart={restart} />}
        </div>
      </div>
    </div>
  );
}

function PassageView({
  passage,
  part,
  picked,
  questions,
}: {
  passage: Passage;
  part: number;
  picked: (string | null)[];
  questions: Question[];
}) {
  return (
    <article className={`passage passage-${passage.kind}`}>
      <p className="passage-kind">{KIND_LABEL[passage.kind] ?? passage.kind}</p>
      {passage.heading && <p className="passage-heading">{passage.heading}</p>}
      <div className="passage-body" lang="en">
        {passage.body.split(/(\{\{\d+\}\}|\[\d\])/).map((piece, i) => {
          const blank = /^\{\{(\d+)\}\}$/.exec(piece);
          if (blank && part === 6) {
            const n = Number(blank[1]);
            const answer = picked[n - 1];
            const state = answer === null ? "" : answer === questions[n - 1]?.answer ? "is-pass" : "is-fail";
            return (
              <span key={i} className={`gap ${state}`}>
                <span className="gap-number">{n}</span>
                {answer ?? " ".repeat(8)}
              </span>
            );
          }
          if (/^\[\d\]$/.test(piece)) {
            return (
              <span key={i} className="position">
                {piece}
              </span>
            );
          }
          return <Fragment key={i}>{piece}</Fragment>;
        })}
      </div>
    </article>
  );
}

function QuestionView({
  number,
  question,
  options,
  picked,
  onPick,
}: {
  number: number;
  question: Question;
  options: string[];
  picked: string | null;
  onPick: (o: string) => void;
}) {
  const correct = picked === question.answer;
  return (
    <div className="rq">
      <p className="rq-head">
        <span className="rq-number">{number}.</span>
        <span className="rq-type">{TYPE_LABEL[question.type] ?? question.type}</span>
      </p>
      <p className="rq-text" lang="en">
        {question.question}
      </p>
      <div className="rq-options" role="group" aria-label={`ตัวเลือกข้อ ${number}`}>
        {options.map((o, i) => {
          const state = picked === null ? "" : o === question.answer ? "is-pass" : o === picked ? "is-fail" : "is-dim";
          return (
            <button key={o} type="button" className={state} disabled={picked !== null} onClick={() => onPick(o)}>
              <span className="drill-letter">({LETTERS[i]})</span> <span lang="en">{o}</span>
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p className={`drill-why ${correct ? "is-pass" : "is-fail"}`} role="status">
          <strong>{correct ? "ถูกต้อง" : "ยังไม่ถูก"}</strong> {question.why}
        </p>
      )}
    </div>
  );
}

function Result({
  set,
  picked,
  elapsed,
  target,
  onRestart,
}: {
  set: ReadingSet;
  picked: (string | null)[];
  elapsed: number;
  target: number;
  onRestart: () => void;
}) {
  const score = set.questions.filter((q, i) => picked[i] === q.answer).length;
  const missedTypes = [...new Set(set.questions.filter((q, i) => picked[i] !== q.answer).map((q) => q.type))];
  return (
    <div className="quiz-end reading-result">
      <div className="quiz-figures">
        <div>
          <p className="quiz-score">
            {score}/{set.questions.length}
          </p>
          <p className="figure-label">คะแนน</p>
        </div>
        <div>
          <p className={`quiz-score ${elapsed > target ? "is-over" : ""}`}>{clock(elapsed)}</p>
          <p className="figure-label">เวลาที่ใช้ (ควรไม่เกิน {clock(target)})</p>
        </div>
      </div>
      <p>
        {elapsed > target
          ? `ช้ากว่าเวลาในข้อสอบจริง ${clock(elapsed - target)} ถ้าทำแบบนี้ทั้ง Part จะทำไม่ทัน ลองอ่านคำถามก่อนแล้วหาเฉพาะข้อมูลที่ต้องใช้`
          : "ทำทันเวลาที่ข้อสอบจริงให้"}
      </p>
      {missedTypes.length > 0 && (
        <p className="tip">ประเภทคำถามที่ควรฝึกเพิ่ม: {missedTypes.map((t) => TYPE_LABEL[t] ?? t).join(", ")}</p>
      )}
      <div className="quiz-actions">
        <button type="button" className="primary" onClick={onRestart}>
          ทำชุดนี้อีกครั้ง
        </button>
        <a className="secondary link-button" href="#/reading">
          เลือกชุดอื่น
        </a>
      </div>
    </div>
  );
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
