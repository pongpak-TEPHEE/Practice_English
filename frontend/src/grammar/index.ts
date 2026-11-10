import { prepositions } from "./prepositions";
import type { Lesson } from "./types";

// Add new lessons here; the grammar page lists them in this order.
export const LESSONS: Lesson[] = [prepositions];

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
