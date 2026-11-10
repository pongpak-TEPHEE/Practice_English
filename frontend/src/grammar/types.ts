export interface Rule {
  word: string; // the word or phrase this row is about
  use: string; // when to use it, in Thai
  examples: string; // short English phrases
}

export interface Example {
  en: string;
  th: string;
  mark: string; // the part of `en` to highlight
}

// A Part 5-style question: one sentence, one blank, four options.
export interface Drill {
  sentence: string; // "___" marks the blank
  options: [string, string, string, string];
  answer: string;
  why: string; // shown after answering, in Thai: why the answer fits and why the others don't
}

// How often a topic shows up on the test, as far as prep-book analyses can tell.
export type Priority = "high" | "medium" | "basic";

export interface Section {
  id: string;
  title: string;
  priority: Priority;
  intro: string;
  rules: Rule[];
  examples: Example[];
  tip?: string;
  drills: Drill[];
}

// What the lesson is worth on the test, stated up front so effort goes where points are.
export interface Analysis {
  parts: string;
  questions: string;
  points: string;
  covers: string[];
  notCovered: string[];
  note: string;
}

export interface Lesson {
  id: string;
  title: string;
  english: string;
  summary: string;
  analysis: Analysis;
  strategy: string[]; // ordered steps for answering this kind of question
  sections: Section[];
}
