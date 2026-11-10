import { useState } from "react";

interface Props {
  learned: number;
  total: number;
}

const SIZE = 220;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

// Rounds down so the ring only reads 100% once every word is learned.
function percent(n: number, total: number) {
  if (total === 0) return "0%";
  const p = (n / total) * 100;
  const digits = p < 10 ? 1 : 0;
  const f = 10 ** digits;
  return `${(Math.floor(p * f) / f).toFixed(digits)}%`;
}

// Share of all words learned: the ring fills to 100% when every word has been passed.
export function ProgressDonut({ learned, total }: Props) {
  const [hover, setHover] = useState<"learned" | "left" | null>(null);
  const left = total - learned;
  const share = total ? learned / total : 0;
  // A 2px gap at both ends keeps the two parts visibly separate.
  // Tiny shares skip the gap and get a minimum length so a first few words still show.
  const gap = share * C > 12 && share < 1 ? 4 : 0;
  const arc = share > 0 ? Math.max(4, share * C - gap) : 0;

  const focus =
    hover === "left"
      ? { value: left.toLocaleString(), label: `คำที่ยังไม่ได้ท่อง (${percent(left, total)})` }
      : hover === "learned"
        ? { value: learned.toLocaleString(), label: `คำที่ท่องผ่านแล้ว (${percent(learned, total)})` }
        : { value: percent(learned, total), label: "ท่องผ่านแล้ว" };

  return (
    <figure className="donut">
      <div className="donut-chart">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`ท่องผ่านแล้ว ${learned} จาก ${total} คำ คิดเป็น ${percent(learned, total)}`}
        >
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            <circle
              className={`donut-left ${hover === "left" ? "is-hover" : ""}`}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              strokeWidth={STROKE}
              fill="none"
              onPointerEnter={() => setHover("left")}
              onPointerLeave={() => setHover(null)}
            />
            {arc > 0 && (
              <circle
                className={`donut-learned ${hover === "learned" ? "is-hover" : ""}`}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${arc} ${C}`}
                strokeDashoffset={-gap / 2}
                strokeLinecap="butt"
                onPointerEnter={() => setHover("learned")}
                onPointerLeave={() => setHover(null)}
              />
            )}
          </g>
        </svg>
        <div className="donut-center" aria-hidden>
          <p className="donut-value">{focus.value}</p>
          <p className="donut-label">{focus.label}</p>
        </div>
      </div>
      <figcaption>
        ท่องผ่านแล้ว <strong>{learned.toLocaleString()}</strong> จาก {total.toLocaleString()} คำ
        {left > 0 ? ` เหลืออีก ${left.toLocaleString()} คำ` : " ครบทุกคำแล้ว"}
      </figcaption>
    </figure>
  );
}
