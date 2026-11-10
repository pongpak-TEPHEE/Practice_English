import { useEffect, useState } from "react";
import { api, setToken } from "../api";
import type { Settings } from "../types";

interface Props {
  onSaved: (s: Settings) => void;
  onError: (e: Error) => void;
  onSignOut: () => void;
}

export function SettingsPage({ onSaved, onError, onSignOut }: Props) {
  const [s, setS] = useState<Settings | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.settings().then(setS).catch(onError);
  }, []);

  if (!s) return <p className="loading">กำลังโหลด</p>;

  const update = (patch: Partial<Settings>) => {
    setS({ ...s, ...patch });
    setStatus("");
  };
  const tiersOk = s.tiers.familiar >= 1 && s.tiers.known > s.tiers.familiar && s.tiers.mastered > s.tiers.known;

  const save = async () => {
    setStatus("กำลังบันทึก");
    try {
      const saved = await api.saveSettings(s);
      setS(saved);
      onSaved(saved);
      setStatus("บันทึกแล้ว");
    } catch (e) {
      setStatus("");
      onError(e as Error);
    }
  };

  return (
    <div className="page settings">
      <h2 className="page-title">ตั้งค่า</h2>
      <section>
        <h3>เป้าหมายรายวัน</h3>
        <p className="help">ตั้งเป้าคำใหม่และคำทวนต่อวันได้ที่หน้าความสำเร็จ</p>
        <Stepper
          label="รอบทวนคำของวันนี้"
          value={s.roundsPerDay}
          min={0}
          max={20}
          onChange={(v) => update({ roundsPerDay: v })}
        />
      </section>

      <section>
        <h3>สำเนียงเสียงอ่าน</h3>
        <div className="segmented" role="radiogroup" aria-label="สำเนียงเสียงอ่าน">
          {(["us", "uk"] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={s.accent === a}
              className={s.accent === a ? "is-on" : ""}
              onClick={() => update({ accent: a })}
            >
              {a === "us" ? "อเมริกัน" : "อังกฤษ"}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>ระดับความเชี่ยวชาญ</h3>
        <p className="help">นับจำนวนวันที่ตอบผ่าน วันละไม่เกิน 1 ครั้ง</p>
        <Stepper
          label="พอจำได้"
          value={s.tiers.familiar}
          min={1}
          max={98}
          suffix="วัน"
          onChange={(v) => update({ tiers: { ...s.tiers, familiar: v } })}
        />
        <Stepper
          label="รู้คำ"
          value={s.tiers.known}
          min={2}
          max={99}
          suffix="วัน"
          onChange={(v) => update({ tiers: { ...s.tiers, known: v } })}
        />
        <Stepper
          label="เชี่ยวชาญ"
          value={s.tiers.mastered}
          min={3}
          max={100}
          suffix="วัน"
          onChange={(v) => update({ tiers: { ...s.tiers, mastered: v } })}
        />
        {!tiersOk && <p className="notice">แต่ละระดับต้องใช้จำนวนวันมากกว่าระดับก่อนหน้า</p>}
      </section>

      <button type="button" className="primary wide" disabled={!tiersOk} onClick={save}>
        บันทึกการตั้งค่า
      </button>
      <p className="save-status" role="status">
        {status}
      </p>

      <section>
        <h3>อุปกรณ์นี้</h3>
        <button
          type="button"
          className="secondary wide"
          onClick={() => {
            setToken("");
            onSignOut();
          }}
        >
          ออกจากระบบ
        </button>
      </section>
    </div>
  );
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  step?: number;
  onChange: (v: number) => void;
}

export function Stepper({ label, value, min, max, suffix = "", step = 1, onChange }: StepperProps) {
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-control">
        <button
          type="button"
          aria-label={`ลด${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          ลด
        </button>
        <span className="stepper-value" aria-live="polite">
          {value} {suffix}
        </span>
        <button
          type="button"
          aria-label={`เพิ่ม${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          เพิ่ม
        </button>
      </div>
    </div>
  );
}
