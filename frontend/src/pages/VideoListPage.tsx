import { useEffect, useState } from "react";
import { api } from "../api";
import { MODE_LABEL, clock, difficultyLabel, percent } from "../video/types";
import type { VideoResult, VideoSummary } from "../video/types";

export function VideoListPage({ onError }: { onError: (e: Error) => void }) {
  const [videos, setVideos] = useState<VideoSummary[] | null>(null);
  const [results, setResults] = useState<VideoResult[]>([]);

  useEffect(() => {
    api.videos().then(setVideos).catch(onError);
    api.videoResults().then(setResults).catch(onError);
  }, []);

  // Videos grouped by category, in the order the categories first appear in the sheet.
  const groups = new Map<string, VideoSummary[]>();
  for (const v of videos ?? []) {
    const c = v.category || "อื่น ๆ";
    groups.set(c, [...(groups.get(c) ?? []), v]);
  }

  return (
    <div className="page">
      <a href="#/home" className="back">
        หน้าแรก
      </a>
      <h2 className="page-title">ฝึกฟังจากวิดีโอ</h2>
      <p className="date">ดูวิดีโอแล้วพิมพ์สิ่งที่ได้ยินทีละบรรทัด วิดีโอหยุดรอจนกว่าจะพิมพ์ถูก แล้วเห็นคำแปลภาษาไทย</p>

      <section className="video-about" aria-labelledby="video-about">
        <h3 id="video-about">ช่วยสอบ TOEIC ได้แค่ไหน</h3>
        <p>
          <strong>ฟังแล้วพิมพ์</strong> ฝึกแยกเสียงพูดต่อเนื่องออกเป็นคำ ซึ่งเป็นพื้นฐานของ Listening Part 1–4 (100 ข้อ
          ครึ่งหนึ่งของคะแนน) ถ้าฟังไม่ออกว่าเป็นคำไหน ก็ตอบคำถามไม่ได้ ไม่ว่าจะรู้ศัพท์มากแค่ไหน
        </p>
        <p>
          แต่เพลงไม่เหมือนข้อสอบ ข้อสอบพูดชัด ความเร็วปกติ เรื่องงานและชีวิตประจำวัน สำเนียงอเมริกัน อังกฤษ แคนาดา
          ออสเตรเลีย ส่วนเพลงร้องยืดเสียงและใช้ภาษาพูดที่ผิดหลักไวยากรณ์ เช่น gonna หรือ we don't gotta think 'bout
          nothin' ซึ่งถ้าใช้ตอบ Part 5 จะผิด ถ้าอยากให้ตรงข้อสอบมากขึ้น ให้เพิ่มวิดีโอข่าว ประกาศ
          หรือบทสนทนาที่ทำงานลงในแท็บ Videos กับ Transcripts ของ Google Sheet ได้เลย
        </p>
      </section>

      {videos === null ? (
        <p className="loading">กำลังโหลด</p>
      ) : videos.length === 0 ? (
        <p className="empty">
          ยังไม่มีวิดีโอ เพิ่มได้ในแท็บ Videos (video_id, title) และแท็บ Transcripts (เวลาเริ่ม เวลาจบ
          และประโยคของแต่ละบรรทัด) ใน Google Sheet แล้วกดโหลดข้อมูลใหม่ในหน้าตั้งค่า
        </p>
      ) : (
        [...groups].map(([category, list]) => (
          <section key={category} aria-label={category}>
            <h3>{category}</h3>
            <nav className="video-list">
              {list.map((v) => {
                const mine = results.filter((r) => r.videoId === v.id);
                const last = mine[0];
                return (
                  <a key={v.id} href={`#/video/${v.id}`} className="video-card">
                    <span className="video-thumb">
                      <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" />
                      <span className="video-length">{clock(v.length)}</span>
                    </span>
                    <span className="video-card-text">
                      <span className="video-title" lang="en">
                        {v.title}
                      </span>
                      <span className="activity-note">
                        {[difficultyLabel(v.difficulty), `${v.lines} บรรทัด`, `${v.words} คำ`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="activity-note">
                        {last
                          ? `ล่าสุด ${MODE_LABEL[last.mode] ?? last.mode} ถูก ${percent(last.wordsCorrect, last.wordsTotal)}% · ฝึกแล้ว ${mine.length} ครั้ง`
                          : "ยังไม่เคยฝึก"}
                      </span>
                    </span>
                  </a>
                );
              })}
            </nav>
          </section>
        ))
      )}
    </div>
  );
}
