export interface Line {
  order: number;
  start: number; // seconds
  end: number;
  en: string;
  th: string;
}

export interface VideoSummary {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  lines: number;
  words: number;
  length: number; // seconds from the first line to the last
}

export interface Video {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  lines: Line[];
}

export type Mode = "dictation" | "type";

export interface VideoResult {
  date?: string;
  time?: string;
  videoId: string;
  mode: Mode;
  linesDone: number;
  linesTotal: number;
  wordsCorrect: number; // right the first time, without a hint
  wordsTotal: number;
  replays: number;
  seconds: number;
  missed: string[];
}

export const MODE_LABEL: Record<Mode, string> = {
  dictation: "ฟังแล้วพิมพ์",
  type: "พิมพ์ตามซับ",
};

const DIFFICULTY_LABEL: Record<string, string> = { easy: "ง่าย", medium: "ปานกลาง", hard: "ยาก" };

export function difficultyLabel(d: string): string {
  return DIFFICULTY_LABEL[d.trim().toLowerCase()] ?? d;
}

// The same rules as the backend's video.Words and video.Key, so the word
// counts agree. Parts in brackets are labels or backing vocals, e.g.
// "(Ariana)" or "(side to side)", and are not typed unless the whole line is
// in brackets.
export function words(text: string): string[] {
  let main = text.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").trim();
  if (key(main) === "") main = text.replace(/[()[\]]/g, " ");
  return main.split(/\s+/).filter((w) => key(w) !== "");
}

// How typed words are compared: lower case, letters and digits only, so
// "I've", "ive" and "Ive" all match.
export function key(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

// A word as it should be listed, without the punctuation around it ("night," -> "night").
export function bare(word: string): string {
  return word.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "").replace(/,/g, "");
}

export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function percent(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}
