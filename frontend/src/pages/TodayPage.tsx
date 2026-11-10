import { useEffect, useState } from "react";
import { api } from "../api";
import type { SessionSpec } from "../components/Session";
import { LEVELS } from "../types";
import type { Level, Today } from "../types";

interface Props {
  onStart: (s: SessionSpec) => void;
  onError: (e: Error) => void;
}

const EXTRA_WORDS = 5;

export function TodayPage({ onStart, onError }: Props) {
  const [today, setToday] = useState<Today | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.today().then(setToday).catch(onError);
  useEffect(() => {
    load();
  }, []);

  if (!today) return <p className="loading">กำลังโหลด</p>;

  const remaining = Math.max(0, today.newGoal - today.learnedToday);
  const learnDone = remaining === 0 || today.newQueue.length === 0;
  const roundsLeft = today.learnedToday > 0 && today.roundsDone < today.roundsGoal;

  const changeLevel = async (level: Level) => {
    if (level === today.level) return;
    setBusy(true);
    try {
      await api.saveSettings({ level });
      await load();
    } catch (e) {
      onError(e as Error);
    } finally {
      setBusy(false);
    }
  };

  const learnMore = async () => {
    setBusy(true);
    try {
      const t = await api.today(EXTRA_WORDS);
      onStart({ title: `คำใหม่ ${t.level}`, mode: "learn", words: t.newQueue });
    } catch (e) {
      onError(e as Error);
    } finally {
      setBusy(false);
    }
  };

  const reviewDue = async () => {
    setBusy(true);
    try {
      const words = await api.words({ deck: "learned" });
      const due = words.filter((w) => w.progress && w.progress.dueDate <= today.date).slice(0, 20);
      onStart({ title: "ทวนคำที่ถึงรอบ", mode: "review", words: due });
    } catch (e) {
      onError(e as Error);
    } finally {
      setBusy(false);
    }
  };

  let primary: { label: string; run: () => void };
  if (!learnDone) {
    primary = {
      label: `ท่องคำใหม่ ${today.newQueue.length} คำ`,
      run: () => onStart({ title: `คำใหม่ ${today.level}`, mode: "learn", words: today.newQueue }),
    };
  } else if (roundsLeft) {
    primary = {
      label: `ทวนรอบที่ ${today.roundsDone + 1}`,
      run: () =>
        onStart({ title: `ทวนรอบที่ ${today.roundsDone + 1}`, mode: "review", words: today.roundQueue }),
    };
  } else {
    primary = { label: `ท่องเพิ่มอีก ${EXTRA_WORDS} คำ`, run: learnMore };
  }

  const dateLabel = new Date(`${today.date}T00:00:00`).toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="page">
      <p className="date">{dateLabel}</p>

      <section className="goal" aria-label="เป้าหมายวันนี้">
        <Goal label="คำใหม่" done={today.learnedToday} goal={today.newGoal} />
        <Goal label="รอบทวน" done={today.roundsDone} goal={today.roundsGoal} />
      </section>

      {learnDone && !roundsLeft && <p className="cheer">ครบเป้าหมายของวันนี้แล้ว</p>}

      <button type="button" className="primary wide" disabled={busy} onClick={primary.run}>
        {primary.label}
      </button>

      {today.dueCount > 0 && (
        <button type="button" className="secondary wide" disabled={busy} onClick={reviewDue}>
          ทวนคำที่ถึงรอบ {today.dueCount} คำ
        </button>
      )}

      <section className="level-pick">
        <h3>ระดับของคำใหม่</h3>
        <div className="segmented" role="radiogroup" aria-label="ระดับของคำใหม่">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={today.level === l}
              className={today.level === l ? "is-on" : ""}
              disabled={busy}
              onClick={() => changeLevel(l)}
            >
              {l}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Goal({ label, done, goal }: { label: string; done: number; goal: number }) {
  return (
    <div className="goal-item">
      <p className="goal-figure">
        <span className="goal-done">{done}</span>
        <span className="goal-of">/{goal}</span>
      </p>
      <p className="goal-label">{label}</p>
      <div className="meter" aria-hidden>
        <span style={{ width: `${goal ? Math.min(done / goal, 1) * 100 : 100}%` }} />
      </div>
    </div>
  );
}
