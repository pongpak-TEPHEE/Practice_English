import { useEffect, useState } from "react";
import { api } from "../api";
import { ProgressDonut } from "../components/ProgressDonut";
import type { Achievements, Stats } from "../types";

// The starting point of the app: pick an activity, see overall progress.
// New activities get their own card in the list below.
export function HomePage({ onError }: { onError: (e: Error) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [ach, setAch] = useState<Achievements | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(onError);
    api.achievements().then(setAch).catch(onError);
  }, []);

  return (
    <div className="page">
      <header className="home-head">
        <h1>ฝึกเพื่อสอบ TOEIC</h1>
        <p className="date">วันนี้จะฝึกอะไรดี</p>
      </header>

      <div className="hub">
        <section aria-labelledby="activities">
          <h3 id="activities">เลือกกิจกรรม</h3>
          <nav className="activities">
            <a href="#/vocab" className="activity">
              <span className="activity-title">ท่องศัพท์</span>
              <span className="activity-note">
                บัตรคำศัพท์ Oxford 3000 ระดับ A1–B2 และคำศัพท์ธุรกิจ TOEIC
                {ach && (
                  <>
                    <br />
                    วันนี้ท่องใหม่ {ach.today.new}/{ach.newGoal} คำ ทวน {ach.today.reviewed}/{ach.reviewGoal} คำ
                  </>
                )}
              </span>
            </a>
            <a href="#/grammar" className="activity activity-grammar">
              <span className="activity-title">ไวยากรณ์</span>
              <span className="activity-note">
                บทเรียนและแบบฝึกแบบ Part 5–6 พร้อมเฉลย
                <br />
                ชนิดคำ รูปกริยา บุพบท คำเชื่อม สรรพนาม
              </span>
            </a>
            <a href="#/reading" className="activity activity-reading">
              <span className="activity-title">การอ่าน Part 6–7</span>
              <span className="activity-note">
                อีเมล ประกาศ บทความ แชท และชุดเอกสาร 2–3 ชิ้น
                <br />
                จับเวลาเทียบกับข้อสอบจริง
              </span>
            </a>
            <a href="#/video" className="activity activity-video">
              <span className="activity-title">ฝึกฟังจากวิดีโอ</span>
              <span className="activity-note">
                ดูวิดีโอ YouTube แล้วพิมพ์สิ่งที่ได้ยินทีละบรรทัด
                <br />
                ฟังแล้วพิมพ์ พิมพ์ตามซับ หรือดูพร้อมซับไทย
              </span>
            </a>
          </nav>
        </section>

        <section className="overall" aria-labelledby="overall">
          <h3 id="overall">ความคืบหน้าทั้งหมด</h3>
          {stats ? (
            <ProgressDonut learned={stats.total - stats.new} total={stats.total} />
          ) : (
            <p className="loading">กำลังโหลด</p>
          )}
        </section>
      </div>
    </div>
  );
}
