import { useEffect, useState } from "react";
import { api } from "../api";
import type { LessonSummary } from "../grammar/types";

export function GrammarPage({ onError }: { onError: (e: Error) => void }) {
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);

  useEffect(() => {
    api.grammarLessons().then(setLessons).catch(onError);
  }, []);

  return (
    <div className="page">
      <a href="#/home" className="back">
        หน้าแรก
      </a>
      <h2 className="page-title">ไวยากรณ์</h2>
      <p className="date">เรียนทีละเรื่อง อ่านกฎ ดูตัวอย่าง แล้วลองทำแบบฝึกที่เฉลยทันที</p>
      {lessons === null ? (
        <p className="loading">กำลังโหลด</p>
      ) : lessons.length === 0 ? (
        <p className="empty">
          ยังไม่มีบทเรียน เพิ่มบทเรียนในแท็บ grammar_lessons ของ Google Sheet แล้วกดโหลดข้อมูลใหม่ในหน้าตั้งค่า
        </p>
      ) : (
        <nav className="activities">
          {lessons.map((l) => (
            <a key={l.id} href={`#/grammar/${l.id}`} className="activity activity-grammar">
              <span className="activity-title">
                {l.title} <span className="activity-en">{l.english}</span>
              </span>
              <span className="activity-note">
                {l.summary}
                <br />
                {l.sections} หัวข้อ · แบบฝึก {l.drills} ข้อ
              </span>
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
