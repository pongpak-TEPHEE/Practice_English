// Reading Part 6 and 7 sets, stored in the Google Sheet (reading_* tabs) and served by the API.
export interface Passage {
  kind: string;
  heading: string;
  body: string; // Part 6 blanks are {{1}}..{{4}}; insertion positions are [1]..[4]
}

export interface Question {
  type: string;
  question: string;
  options: string[];
  answer: string;
  why: string;
}

export interface ReadingSet {
  id: string;
  part: number;
  title: string;
  passages: Passage[];
  questions: Question[];
}

export interface ReadingSummary {
  id: string;
  part: number;
  title: string;
  kinds: string[];
  questions: number;
}

export interface ReadingGuide {
  part: number;
  title: string;
  summary: string;
  analysis: {
    parts: string;
    questions: string;
    points: string;
    covers: string[];
    notCovered: string[];
    note: string;
  };
  strategy: string[];
  questionTypes: { name: string; how: string }[];
}

export interface ReadingOverview {
  guides: ReadingGuide[];
  sets: ReadingSummary[];
}

export const KIND_LABEL: Record<string, string> = {
  email: "อีเมล",
  letter: "จดหมาย",
  memo: "บันทึกภายใน",
  notice: "ประกาศ",
  advertisement: "โฆษณา",
  article: "บทความ",
  "text-chain": "ข้อความแชท",
  form: "แบบฟอร์ม",
  webpage: "หน้าเว็บ",
  schedule: "ตาราง",
};

export const TYPE_LABEL: Record<string, string> = {
  grammar: "ไวยากรณ์",
  vocabulary: "คำศัพท์ตามบริบท",
  transition: "คำเชื่อม",
  sentence: "เลือกประโยค",
  purpose: "ใจความหลัก / จุดประสงค์",
  detail: "รายละเอียด",
  not: "ข้อใดไม่ได้กล่าวถึง (NOT)",
  inference: "อนุมาน",
  synonym: "ความหมายคำ",
  insert: "แทรกประโยค",
  intent: "เจตนาผู้เขียนในแชท",
  cross: "ใช้ข้อมูลหลายเอกสาร",
};

// Seconds the real test allows: about 2 minutes per Part 6 text, 1 minute per Part 7 question.
export function targetSeconds(part: number, questions: number): number {
  return part === 6 ? 120 : questions * 60;
}
