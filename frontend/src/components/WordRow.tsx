import { STATUS_LABEL } from "../types";
import type { Word } from "../types";

export function WordRow({ word, showRounds = false }: { word: Word; showRounds?: boolean }) {
  const p = word.progress;
  return (
    <li className="word-row">
      <div className="word-row-main">
        <p className="word-row-head">
          <span className="word-row-word" lang="en">
            {word.word}
          </span>
          <span className="pos">{word.pos}</span>
        </p>
        <p className="word-row-th">{word.meaningTh}</p>
      </div>
      <div className="word-row-side">
        <span className={`tier-tag tier-${word.status}`}>{STATUS_LABEL[word.status]}</span>
        {showRounds && p && <span className="word-row-meta">ทวน {p.reviewCount} รอบ</span>}
        {p && p.passDays > 0 && <span className="word-row-meta">ผ่าน {p.passDays} วัน</span>}
        {p?.favorite && <span className="word-row-meta fav">คำโปรด</span>}
      </div>
    </li>
  );
}
