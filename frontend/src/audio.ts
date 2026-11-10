import type { Accent, Word } from "./types";

// Plays Oxford's recording for the chosen accent; falls back to the browser's voice.
export function playWord(word: Word, accent: Accent) {
  const url = accent === "uk" ? word.audioUk || word.audioUs : word.audioUs || word.audioUk;
  if (!url) {
    speak(word.word, accent);
    return;
  }
  const audio = new Audio(url);
  let fellBack = false;
  const fallback = () => {
    if (!fellBack) {
      fellBack = true;
      speak(word.word, accent);
    }
  };
  audio.addEventListener("error", fallback);
  audio.play().catch(fallback);
}

export function speak(text: string, accent: Accent) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = accent === "uk" ? "en-GB" : "en-US";
  u.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
