import { useMemo, useState } from "react";
import type { Drill as DrillData } from "../grammar/types";
import { shuffle } from "../shuffle";

interface Props {
  drill: DrillData;
  number?: number;
  onAnswered?: (correct: boolean) => void;
}

const LETTERS = ["A", "B", "C", "D"];

// One Part 5-style question: pick an option, then see whether it was right and why.
export function Drill({ drill, number, onAnswered }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  // Shuffled once per question so the answer's position gives nothing away.
  const options = useMemo(() => shuffle(drill.options), [drill]);
  const [before, after] = drill.sentence.split("___");
  const correct = picked === drill.answer;

  const pick = (o: string) => {
    if (picked) return;
    setPicked(o);
    onAnswered?.(o === drill.answer);
  };

  return (
    <div className="drill">
      <p className="drill-sentence" lang="en">
        {number !== undefined && <span className="drill-number">{number}.</span>}
        {before}
        <span className={`drill-blank ${picked ? (correct ? "is-pass" : "is-fail") : ""}`}>
          {picked ?? " ".repeat(6)}
        </span>
        {after}
      </p>
      <div className="drill-options" role="group" aria-label="ตัวเลือก">
        {options.map((o, i) => {
          const state = !picked ? "" : o === drill.answer ? "is-pass" : o === picked ? "is-fail" : "is-dim";
          return (
            <button key={o} type="button" className={state} disabled={Boolean(picked)} onClick={() => pick(o)}>
              <span className="drill-letter">({LETTERS[i]})</span> <span lang="en">{o}</span>
            </button>
          );
        })}
      </div>
      {picked && (
        <p className={`drill-why ${correct ? "is-pass" : "is-fail"}`} role="status">
          <strong>{correct ? "ถูกต้อง" : `ยังไม่ถูก คำตอบคือ ${drill.answer}`}</strong> {drill.why}
        </p>
      )}
    </div>
  );
}
