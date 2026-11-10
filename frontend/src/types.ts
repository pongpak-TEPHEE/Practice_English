// A1–B2 are the Oxford 3000's CEFR levels; TOEIC is business vocabulary from the
// TOEIC Service List that the Oxford 3000 does not include.
export type Level = "A1" | "A2" | "B1" | "B2" | "TOEIC";
export const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "TOEIC"];

export type Status = "new" | "learning" | "familiar" | "known" | "mastered";
export type Result = "pass" | "fail";
export type Mode = "learn" | "review";
export type Accent = "us" | "uk";

export interface Progress {
  wordId: number;
  dueDate: string;
  lastReviewed: string;
  reviewCount: number;
  favorite: boolean;
  passCount: number;
  failCount: number;
  passDays: number;
  recent: string;
  missed: boolean;
  learnedDate: string;
  roundDate: string;
  roundsToday: number;
}

export interface Word {
  id: number;
  word: string;
  pos: string;
  level: Level;
  meaningTh: string;
  example: string;
  audioUk: string;
  audioUs: string;
  status: Status;
  progress?: Progress;
}

export interface Today {
  date: string;
  level: Level;
  newGoal: number;
  learnedToday: number;
  roundsGoal: number;
  roundsDone: number;
  dueCount: number;
  newQueue: Word[];
  roundQueue: Word[];
}

export interface Tiers {
  familiar: number;
  known: number;
  mastered: number;
}

export interface Settings {
  newPerDay: number;
  roundsPerDay: number;
  reviewPerDay: number;
  level: Level;
  accent: Accent;
  tiers: Tiers;
}

export interface Counts {
  total: number;
  new: number;
  learning: number;
  familiar: number;
  known: number;
  mastered: number;
}

export interface Stats extends Counts {
  favorites: number;
  missed: number;
  dueToday: number;
  reviewedToday: number;
  byLevel: (Counts & { level: Level })[];
}

export const STATUS_LABEL: Record<Status, string> = {
  new: "ยังไม่ได้ท่อง",
  learning: "กำลังเรียน",
  familiar: "พอจำได้",
  known: "รู้คำ",
  mastered: "เชี่ยวชาญ",
};

export const TIER_ORDER: Exclude<Status, "new">[] = ["learning", "familiar", "known", "mastered"];

export interface DayWord {
  wordId: number;
  word: string;
  level: Level;
  passes: number;
  fails: number;
}

export interface Day {
  date: string;
  learned: DayWord[];
  reviewed: DayWord[];
}

export interface DayGoal {
  date: string;
  new: number;
  reviewed: number;
  met: boolean;
}

export interface Achievements {
  newGoal: number;
  reviewGoal: number;
  today: DayGoal;
  streak: number;
  bestStreak: number;
  daysMet: number;
  totalLearned: number;
  recent: DayGoal[];
}

export function thaiDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" },
) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("th-TH", opts);
}
