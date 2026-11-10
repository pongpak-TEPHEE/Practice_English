import { useEffect, useState } from "react";
import { api } from "../api";
import { LEVELS } from "../types";
import type { Achievements, Level, Stats } from "../types";

interface Props {
  level: Level;
  onLevel: (l: Level) => Promise<void>;
  onError: (e: Error) => void;
}

export function HomePage({ level, onLevel, onError }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [ach, setAch] = useState<Achievements | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.stats().then(setStats).catch(onError);
    api.achievements().then(setAch).catch(onError);
  }, []);

  const lv = stats?.byLevel.find((b) => b.level === level);
  const learned = lv ? lv.total - lv.new : 0;

  const pick = async (l: Level) => {
    if (l === level) return;
    setBusy(true);
    try {
      await onLevel(l);
    } finally {
      setBusy(false);
    }
  };

  const menus = [
    {
      href: "#/learn",
      title: "ท่องศัพท์ใหม่",
      note: ach ? `วันนี้ ${ach.today.new}/${ach.newGoal} คำ` : "",
    },
    {
      href: "#/review",
      title: "ทวนศัพท์เก่า",
      note: ach ? `วันนี้ ${ach.today.reviewed}/${ach.reviewGoal} คำ` : "",
    },
    { href: "#/history", title: "ประวัติ", note: "คำที่ผ่าน ไม่ผ่าน และสิ่งที่เรียนแต่ละวัน" },
    {
      href: "#/goals",
      title: "ความสำเร็จ",
      note: ach ? (ach.streak > 0 ? `ทำครบเป้า ${ach.streak} วันติด` : "ตั้งเป้าหมายรายวัน") : "",
    },
  ];

  return (
    <div className="page">
      <header className="home-head">
        <h1>ท่องศัพท์</h1>
        <p className="date">Oxford 3000 สำหรับเตรียมสอบ TOEIC</p>
      </header>

      <section>
        <h3>ระดับของคำศัพท์</h3>
        <div className="segmented" role="radiogroup" aria-label="ระดับของคำศัพท์">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={level === l}
              className={level === l ? "is-on" : ""}
              disabled={busy}
              onClick={() => pick(l)}
            >
              {l}
            </button>
          ))}
        </div>
        {lv && (
          <div className="level-progress">
            <p>
              ท่องผ่านแล้ว <strong>{learned}</strong> จาก {lv.total} คำ
            </p>
            <div className="meter" aria-hidden>
              <span style={{ width: `${(learned / Math.max(lv.total, 1)) * 100}%` }} />
            </div>
          </div>
        )}
      </section>

      <nav className="menu" aria-label={`เมนูระดับ ${level}`}>
        {menus.map((m) => (
          <a key={m.href} href={m.href} className="menu-item">
            <span className="menu-title">{m.title}</span>
            <span className="menu-note">{m.note}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
