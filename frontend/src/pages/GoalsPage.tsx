import { useEffect, useState } from "react";
import { api } from "../api";
import { thaiDate } from "../types";
import type { Achievements, Settings } from "../types";
import { Stepper } from "./SettingsPage";

interface Props {
  onError: (e: Error) => void;
}

export function GoalsPage({ onError }: Props) {
  const [ach, setAch] = useState<Achievements | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState("");

  const load = () => api.achievements().then(setAch).catch(onError);
  useEffect(() => {
    load();
    api.settings().then(setSettings).catch(onError);
  }, []);

  if (!ach || !settings) return <p className="loading">กำลังโหลด</p>;

  const dirty = settings.newPerDay !== ach.newGoal || settings.reviewPerDay !== ach.reviewGoal;
  const save = async () => {
    setStatus("กำลังบันทึก");
    try {
      setSettings(await api.saveSettings({ newPerDay: settings.newPerDay, reviewPerDay: settings.reviewPerDay }));
      await load();
      setStatus("บันทึกเป้าหมายแล้ว");
    } catch (e) {
      setStatus("");
      onError(e as Error);
    }
  };

  return (
    <div className="page">
      <a href="#/home" className="back">
        กลับ
      </a>
      <h2 className="page-title">ความสำเร็จ</h2>

      <div className="goals-grid">
        <div className="goals-col">
          <section className="goal" aria-label="ความคืบหน้าวันนี้">
            <Meter label="คำใหม่วันนี้" done={ach.today.new} goal={ach.newGoal} />
            <Meter label="คำทวนวันนี้" done={ach.today.reviewed} goal={ach.reviewGoal} />
          </section>
          {ach.today.met && <p className="cheer">ครบเป้าหมายของวันนี้แล้ว</p>}

          <section className="streaks">
            <Figure value={ach.streak} label="วันติดต่อกัน" />
            <Figure value={ach.bestStreak} label="สถิติสูงสุด" />
            <Figure value={ach.totalLearned} label="คำที่ท่องผ่าน" />
          </section>
        </div>

        <div className="goals-col">
          <section>
            <h3>14 วันล่าสุด</h3>
            <ol className="calendar">
              {ach.recent.map((d) => (
                <li
                  key={d.date}
                  className={d.met ? "is-met" : d.new + d.reviewed > 0 ? "is-some" : ""}
                  title={`${thaiDate(d.date, { day: "numeric", month: "short" })}: ใหม่ ${d.new} ทวน ${d.reviewed}`}
                >
                  <span>{Number(d.date.slice(8))}</span>
                </li>
              ))}
            </ol>
            <p className="legend">
              <span className="legend-item cal-met">ครบเป้า</span>
              <span className="legend-item cal-some">ได้เรียนบ้าง</span>
            </p>
          </section>

          <section className="settings">
            <h3>ตั้งเป้าหมายรายวัน</h3>
            <Stepper
              label="คำใหม่ต่อวัน"
              value={settings.newPerDay}
              min={1}
              max={100}
              suffix="คำ"
              onChange={(v) => setSettings({ ...settings, newPerDay: v })}
            />
            <Stepper
              label="ทวนคำต่อวัน"
              value={settings.reviewPerDay}
              min={0}
              max={500}
              step={5}
              suffix="คำ"
              onChange={(v) => setSettings({ ...settings, reviewPerDay: v })}
            />
          </section>
          <button type="button" className="primary wide" disabled={!dirty} onClick={save}>
            บันทึกเป้าหมาย
          </button>
          <p className="save-status" role="status">
            {status}
          </p>
        </div>
      </div>
    </div>
  );
}

function Meter({ label, done, goal }: { label: string; done: number; goal: number }) {
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

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="figure">
      <p className="figure-value">{value}</p>
      <p className="figure-label">{label}</p>
    </div>
  );
}
