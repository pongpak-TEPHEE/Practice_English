// Loads the YouTube IFrame Player API once and exposes the few calls we use.
// https://developers.google.com/youtube/iframe_api_reference

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  destroy(): void;
  // Not in the reference, but the long-standing way to turn captions off.
  unloadModule?(name: string): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onError?: (e: { data: number }) => void;
        onStateChange?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const PLAYING = 1;

let loading: Promise<YTNamespace> | null = null;

export function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT!);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        loading = null;
        script.remove();
        reject(new Error("โหลดตัวเล่น YouTube ไม่ได้ ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วเปิดหน้านี้อีกครั้ง"));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

// Error codes from the player's onError event, in the learner's words.
export function playerErrorMessage(code: number): string {
  if (code === 101 || code === 150 || code === 153)
    return "เจ้าของวิดีโอไม่อนุญาตให้เล่นในเว็บอื่น เปลี่ยนเป็นวิดีโออื่นในแท็บ Videos ของ Google Sheet";
  if (code === 100) return "ไม่พบวิดีโอนี้บน YouTube อาจถูกลบหรือตั้งเป็นส่วนตัว ตรวจ video_id ในแท็บ Videos";
  if (code === 2) return "video_id ในแท็บ Videos ไม่ถูกต้อง";
  return "เล่นวิดีโอไม่ได้ ลองเปิดหน้านี้อีกครั้ง";
}
