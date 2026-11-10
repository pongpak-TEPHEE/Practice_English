export interface Rule {
  word: string; // the preposition(s) this row is about
  use: string; // when to use it, in Thai
  examples: string; // short English phrases
}

export interface Example {
  en: string;
  th: string;
  mark: string; // the part of `en` to highlight
}

export interface Drill {
  sentence: string; // "___" marks the blank
  options: string[];
  answer: string;
  why: string; // shown after answering, in Thai
}

export interface Section {
  id: string;
  title: string;
  intro: string;
  rules: Rule[];
  examples: Example[];
  tip?: string;
  drills: Drill[];
}

export interface Lesson {
  id: string;
  title: string;
  english: string;
  summary: string;
  sections: Section[];
}
