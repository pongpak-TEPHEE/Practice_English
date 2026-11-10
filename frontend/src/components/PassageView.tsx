import { Fragment } from "react";
import { KIND_LABEL } from "../reading/types";
import type { Passage, Question } from "../reading/types";

// Renders a reading passage. Part 6 blanks ({{n}}) show the chosen answer once
// picked; when showResult is false (mock exam) they are not colored right or wrong.
export function PassageView({
  passage,
  part,
  picked,
  questions,
  showResult = true,
}: {
  passage: Passage;
  part: number;
  picked: (string | null)[];
  questions: Question[];
  showResult?: boolean;
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
            const state =
              answer === null || !showResult ? "" : answer === questions[n - 1]?.answer ? "is-pass" : "is-fail";
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
