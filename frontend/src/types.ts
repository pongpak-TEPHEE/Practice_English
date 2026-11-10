export type Level = "A1" | "A2" | "B1" | "B2";
export const LEVELS: Level[] = ["A1", "A2", "B1", "B2"];

export type Status = "new" | "learning" | "familiar" | "known" | "mastered";
export type Result = "pass" | "fail";
export type Mode = "learn" | "review";
export type Accent = "us" | "uk";

export interface Progress {
  wordId: number;
  dueDate: string;
  lastReviewed: string;
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
