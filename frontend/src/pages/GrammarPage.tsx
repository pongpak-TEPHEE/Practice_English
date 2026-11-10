import { LESSONS } from "../grammar";

export function GrammarPage() {
  return (
    <div className="page">
      <a href="#/home" className="back">
        หน้าแรก
      </a>
      <h2 className="page-title">ไวยากรณ์</h2>
      <p className="date">เรียนทีละเรื่อง อ่านกฎ ดูตัวอย่าง แล้วลองทำแบบฝึกที่เฉลยทันที</p>
      <nav className="activities">
        {LESSONS.map((l) => (
          <a key={l.id} href={`#/grammar/${l.id}`} className="activity activity-grammar">
            <span className="activity-title">
              {l.title} <span className="activity-en">{l.english}</span>
            </span>
            <span className="activity-note">
              {l.summary}
              <br />
              {l.sections.length} หัวข้อ · แบบฝึก {l.sections.reduce((n, s) => n + s.drills.length, 0)} ข้อ
            </span>
          </a>
        ))}
      </nav>
    </div>
  );
}
