import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../api";
import { MODE_LABEL, bare, clock, difficultyLabel, key, percent, typedParts, words } from "../video/types";
import type { Mode, Video, VideoResult } from "../video/types";
import { PLAYING, loadYouTube, playerErrorMessage } from "../video/youtube";
import type { YTPlayer } from "../video/youtube";

interface Props {
  id: string;
  onError: (e: Error) => void;
}

export function VideoPage({ id, onError }: Props) {
  const [video, setVideo] = useState<Video | null | undefined>(undefined); // null = not found
  const [history, setHistory] = useState<VideoResult[]>([]);

  useEffect(() => {
    api
      .video(id)
      .then(setVideo)
      .catch((e: Error) => {
        if (e instanceof ApiError && e.status === 404) setVideo(null);
        else onError(e);
      });
    api
      .videoResults()
      .then((all) => setHistory(all.filter((r) => r.videoId === id)))
      .catch(onError);
  }, [id]);

  if (video === undefined) return <p className="loading">กำลังโหลด</p>;
  if (video === null) {
    return (
      <div className="page">
        <a href="#/video" className="back">
          ฝึกฟัง
        </a>
        <p className="empty">ไม่พบวิดีโอนี้ อาจถูกลบออกจาก Google Sheet เลือกวิดีโอจากหน้าฝึกฟังได้เลย</p>
      </div>
    );
  }
  return <Practice key={video.id} video={video} history={history} onSaved={(r) => setHistory((h) => [r, ...h])} />;
}

type View = Mode | "watch";
type Phase = "setup" | "run" | "done";

const VIEWS: { id: View; label: string; note: string }[] = [
  {
    id: "dictation",
    label: "ฟังแล้วพิมพ์",
    note: "ซ่อนซับ เห็นแค่ช่องว่างตามจำนวนตัวอักษร ฝึกฟังให้ออกว่าเป็นคำไหน ตรงกับทักษะที่ใช้ใน Listening มากที่สุด",
  },
  { id: "type", label: "พิมพ์ตามซับ", note: "เห็นซับแล้วพิมพ์ตามไปพร้อมกับวิดีโอ ฝึกสะกดคำและอ่านให้ทันเสียง" },
  { id: "watch", label: "ดูพร้อมซับ", note: "ดูวิดีโอพร้อมซับอังกฤษและไทย กดบรรทัดไหนก็ได้เพื่อฟังซ้ำหรือพูดตาม" },
];

const RATES = [0.5, 0.75, 1];
const VIEW_KEY = "toeic-video-view";

// What is known about each word of the line being typed. A word counts as
// right the first time when it was right the first time it was finished (by
// typing a space after it, or as the last word), without a hint or the answer.
interface LineWork {
  firstTry: (boolean | undefined)[];
  hinted: Set<number>;
  revealed: boolean;
}

interface DoneLine {
  index: number;
  skipped: boolean;
  firstTry: boolean[];
}

const newWork = (): LineWork => ({ firstTry: [], hinted: new Set(), revealed: false });

function readView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "dictation" || v === "type" || v === "watch") return v;
  } catch {
    // storage may be blocked; fall back to the default
  }
  return "dictation";
}

function saveView(v: View) {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // not important enough to report
  }
}

function Practice({
  video,
  history,
  onSaved,
}: {
  video: Video;
  history: VideoResult[];
  onSaved: (r: VideoResult) => void;
}) {
  const lines = video.lines;
  const targets = useMemo(() => lines.map((l) => words(l.en)), [lines]);
  const keys = useMemo(() => targets.map((ws) => ws.map(key)), [targets]);
  const length = lines[lines.length - 1].end - lines[0].start;

  // ---- the YouTube player ----
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const hideCaptions = useRef(false); // YouTube's own captions would give the answer away

  useEffect(() => {
    let cancelled = false;
    let player: YTPlayer | null = null;
    const host = hostRef.current;
    loadYouTube()
      .then((YT) => {
        if (cancelled || !host) return;
        // The player replaces this element with an iframe, so React must not own it.
        const el = document.createElement("div");
        host.appendChild(el);
        player = new YT.Player(el, {
          videoId: video.id,
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, disablekb: 1, cc_load_policy: 0, iv_load_policy: 3 },
          events: {
            onReady: () => {
              if (cancelled) return;
              playerRef.current = player;
              setReady(true);
            },
            onError: (e) => setPlayerError(playerErrorMessage(e.data)),
            onStateChange: (e) => {
              if (e.data !== PLAYING || !hideCaptions.current) return;
              try {
                player?.unloadModule?.("captions");
                player?.unloadModule?.("cc");
              } catch {
                // older players have no captions module to unload
              }
            },
          },
        });
      })
      .catch((e: Error) => setPlayerError(e.message));
    return () => {
      cancelled = true;
      playerRef.current = null;
      try {
        player?.destroy();
      } catch {
        // the player may not have finished loading
      }
      if (host) host.innerHTML = "";
    };
  }, [video.id]);

  // ---- practice state ----
  const [view, setView] = useState<View>(readView);
  const [phase, setPhase] = useState<Phase>("setup");
  const [cur, setCur] = useState(0);
  const curRef = useRef(0);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [showTh, setShowTh] = useState(false);
  const [rate, setRate] = useState(1);
  const [cover, setCover] = useState(true); // hide lyrics burned into the picture
  const [done, setDone] = useState<DoneLine[]>([]);
  const [replays, setReplays] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [finishedAt, setFinishedAt] = useState(0);
  const [active, setActive] = useState(-1); // the line being shown in watch mode
  const [, redraw] = useState(0);
  const work = useRef<LineWork>(newWork());
  const inputRef = useRef<HTMLInputElement>(null);
  const [save, setSave] = useState<{ state: "idle" | "saving" | "saved" | "failed"; result?: VideoResult }>({
    state: "idle",
  });

  const typing = phase === "run" && view !== "watch";
  hideCaptions.current = view === "dictation";
  const goTo = (i: number) => {
    curRef.current = i;
    setCur(i);
  };
  const focusInput = () => window.setTimeout(() => inputRef.current?.focus(), 0);

  // Pause at the end of the line until it is typed; in watch mode, follow the video.
  useEffect(() => {
    if (!ready || phase !== "run") return;
    const t = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const now = p.getCurrentTime();
      if (view === "watch") {
        let i = -1;
        while (i + 1 < lines.length && lines[i + 1].start <= now + 0.05) i++;
        setActive(i);
        return;
      }
      const line = lines[curRef.current];
      if (line && now >= line.end - 0.03 && p.getPlayerState() === PLAYING) {
        p.pauseVideo();
        setWaiting(true);
      }
    }, 50);
    return () => window.clearInterval(t);
  }, [ready, phase, view, lines]);

  // Leaving mid-way loses the lines typed so far.
  useEffect(() => {
    if (!typing || done.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [typing, done.length]);

  const play = (from: number) => {
    const p = playerRef.current;
    if (!p) return;
    p.seekTo(Math.max(0, from), true);
    p.playVideo();
  };

  const start = () => {
    if (!playerRef.current) return;
    work.current = newWork();
    goTo(0);
    setInput("");
    setDone([]);
    setReplays(0);
    setWaiting(false);
    setActive(-1);
    setSave({ state: "idle" });
    setStartedAt(Date.now());
    setPhase("run");
    playerRef.current.setPlaybackRate(rate);
    play(lines[0].start - 0.3);
    focusInput();
  };

  const changeRate = (r: number) => {
    setRate(r);
    playerRef.current?.setPlaybackRate(r);
    if (typing) focusInput();
  };

  const replay = () => {
    play(lines[curRef.current].start - 0.25);
    setWaiting(false);
    setReplays((n) => n + 1);
    focusInput();
  };

  const finish = (list: DoneLine[]) => {
    playerRef.current?.pauseVideo();
    setWaiting(false);
    setFinishedAt(Date.now());
    setPhase("done");
    if (list.length > 0 && view !== "watch") store(buildResult(list));
  };

  const buildResult = (list: DoneLine[]): VideoResult => {
    const missed: string[] = [];
    const seen = new Set<string>();
    for (const d of list) {
      d.firstTry.forEach((ok, j) => {
        const w = bare(targets[d.index][j]).slice(0, 60);
        if (!ok && w && !seen.has(w.toLowerCase())) {
          seen.add(w.toLowerCase());
          missed.push(w);
        }
      });
    }
    return {
      videoId: video.id,
      mode: view as Mode,
      linesDone: list.length,
      linesTotal: lines.length,
      wordsCorrect: list.reduce((n, d) => n + d.firstTry.filter(Boolean).length, 0),
      wordsTotal: list.reduce((n, d) => n + d.firstTry.length, 0),
      replays,
      seconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      missed: missed.slice(0, 200),
    };
  };

  const store = (r: VideoResult) => {
    setSave({ state: "saving", result: r });
    api
      .saveVideoResult(r)
      .then((saved) => {
        setSave({ state: "saved", result: saved });
        onSaved(saved);
      })
      .catch(() => setSave({ state: "failed", result: r }));
  };

  const completeLine = (skipped: boolean) => {
    const i = curRef.current;
    const w = work.current;
    const firstTry = keys[i].map((_, j) => w.firstTry[j] ?? (!skipped && !w.revealed && !w.hinted.has(j)));
    const list = [...done, { index: i, skipped, firstTry }];
    setDone(list);
    setInput("");
    work.current = newWork();
    if (i + 1 >= lines.length) {
      finish(list);
      return;
    }
    goTo(i + 1);
    const p = playerRef.current;
    if (p && p.getPlayerState() !== PLAYING) {
      // Skip a long instrumental gap; otherwise carry on from where the video stopped.
      const next = lines[i + 1];
      if (next.start - p.getCurrentTime() > 1) p.seekTo(Math.max(0, next.start - 0.2), true);
      p.playVideo();
    }
    setWaiting(false);
  };

  const onInput = (value: string) => {
    const target = keys[curRef.current];
    const parts = typedParts(value);
    const w = work.current;
    for (let j = 0; j < Math.min(parts.length - 1, target.length); j++) {
      if (w.firstTry[j] === undefined) w.firstTry[j] = !w.revealed && !w.hinted.has(j) && key(parts[j]) === target[j];
    }
    const typed = parts.map(key).filter(Boolean);
    if (typed.length === target.length && typed.every((k, j) => k === target[j])) completeLine(false);
    else setInput(value);
  };

  // Fill in the first word that is missing or wrong.
  const hint = () => {
    const i = curRef.current;
    const parts = typedParts(input.trim()).filter(Boolean);
    let j = 0;
    while (j < keys[i].length && j < parts.length && key(parts[j]) === keys[i][j]) j++;
    if (j >= keys[i].length) return;
    work.current.hinted.add(j);
    if (work.current.firstTry[j] === undefined) work.current.firstTry[j] = false;
    const filled = [...parts.slice(0, j), bare(targets[i][j])].join(" ");
    onInput(j < keys[i].length - 1 ? filled + " " : filled);
    focusInput();
  };

  const reveal = () => {
    const w = work.current;
    w.revealed = true;
    keys[curRef.current].forEach((_, j) => {
      if (w.firstTry[j] === undefined) w.firstTry[j] = false;
    });
    redraw((n) => n + 1);
    focusInput();
  };

  const chooseView = (v: View) => {
    setView(v);
    saveView(v);
  };

  const line = lines[cur];
  const showText = view === "type" || work.current.revealed;
  const previous = history.find((r) => r.mode === view);

  return (
    <div className="page video-page">
      <a href="#/video" className="back">
        ฝึกฟัง
      </a>
      <header>
        <h2 className="page-title video-page-title" lang="en">
          {video.title}
        </h2>
        <p className="date">
          {[difficultyLabel(video.difficulty), `${lines.length} บรรทัด`, clock(length)].filter(Boolean).join(" · ")}
        </p>
      </header>

      <div className="video-layout">
        <div className="video-stage">
          <div className="video-frame-wrap">
            <div className="video-frame" ref={hostRef} />
            {view === "dictation" && cover && phase === "run" && (
              <div className="video-cover" aria-hidden="true">
                ซ่อนซับในวิดีโอ
              </div>
            )}
          </div>
          {playerError && (
            <p className="notice" role="alert">
              {playerError}
            </p>
          )}
          {phase === "run" && (
            <div className="video-tools">
              <div className="segmented small" role="group" aria-label="ความเร็ววิดีโอ">
                {RATES.map((r) => (
                  <button key={r} type="button" className={rate === r ? "is-on" : ""} onClick={() => changeRate(r)}>
                    {r}x
                  </button>
                ))}
              </div>
              <label className="check">
                <input type="checkbox" checked={showTh} onChange={(e) => setShowTh(e.target.checked)} />
                {view === "watch" ? "แสดงคำแปล" : "แสดงคำแปลก่อนพิมพ์"}
              </label>
              {view === "dictation" && <CoverCheck cover={cover} onChange={setCover} />}
            </div>
          )}
        </div>

        <div className="video-panel">
          {phase === "setup" && (
            <div className="video-setup">
              <div className="segmented" role="radiogroup" aria-label="วิธีฝึก">
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={view === v.id}
                    className={view === v.id ? "is-on" : ""}
                    onClick={() => chooseView(v.id)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <p className="help">{VIEWS.find((v) => v.id === view)?.note}</p>
              {view !== "watch" && (
                <p className="help">
                  วิดีโอจะหยุดที่ท้ายบรรทัดจนกว่าจะพิมพ์ถูกทุกคำ ไม่ต้องสนใจตัวพิมพ์ใหญ่และเครื่องหมาย กด Enter
                  เพื่อฟังบรรทัดนั้นอีกครั้ง
                </p>
              )}
              {view === "dictation" && <CoverCheck cover={cover} onChange={setCover} />}
              <div className="segmented small" role="group" aria-label="ความเร็ววิดีโอ">
                {RATES.map((r) => (
                  <button key={r} type="button" className={rate === r ? "is-on" : ""} onClick={() => setRate(r)}>
                    ความเร็ว {r}x
                  </button>
                ))}
              </div>
              <button type="button" className="primary wide" disabled={!ready} onClick={start}>
                {ready
                  ? view === "watch"
                    ? "เริ่มดู"
                    : "เริ่มฝึก"
                  : playerError
                    ? "เล่นวิดีโอไม่ได้"
                    : "กำลังโหลดวิดีโอ"}
              </button>
              {history.length > 0 && <History history={history} />}
            </div>
          )}

          {typing && (
            <div className="typing">
              <div className="typing-head">
                <span>
                  บรรทัด {cur + 1}/{lines.length}
                </span>
                <span className={waiting ? "typing-wait" : ""} aria-live="polite">
                  {waiting ? "วิดีโอหยุดรอ พิมพ์ให้ครบหรือกด Enter เพื่อฟังอีกครั้ง" : "กำลังเล่น"}
                </span>
              </div>
              <div className="meter" aria-hidden="true">
                <span style={{ width: `${(done.length / lines.length) * 100}%` }} />
              </div>

              <Slots words={targets[cur]} keys={keys[cur]} input={input} showText={showText} />
              {showTh && line.th && <p className="typing-th">{line.th}</p>}

              <input
                ref={inputRef}
                className="typing-input"
                lang="en"
                value={input}
                onChange={(e) => onInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    replay();
                  }
                }}
                aria-label={`พิมพ์สิ่งที่ได้ยินในบรรทัดที่ ${cur + 1}`}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
              />
              {/[฀-๿]/.test(input) && <p className="tip">แป้นพิมพ์ยังเป็นภาษาไทยอยู่ เปลี่ยนเป็นภาษาอังกฤษก่อน</p>}

              <div className="typing-actions">
                <button type="button" className="secondary" onClick={replay}>
                  ฟังอีกครั้ง
                </button>
                {view === "dictation" && (
                  <button type="button" className="secondary" onClick={hint}>
                    ใบ้ 1 คำ
                  </button>
                )}
                {view === "dictation" && !work.current.revealed && (
                  <button type="button" className="secondary" onClick={reveal}>
                    ดูเฉลย
                  </button>
                )}
                <button type="button" className="text-btn" onClick={() => completeLine(true)}>
                  ข้ามบรรทัดนี้
                </button>
              </div>

              {done.length > 0 && (
                <>
                  <ol className="done-lines" aria-label="บรรทัดที่ทำแล้ว ล่าสุดอยู่บนสุด">
                    {[...done].reverse().map((d) => (
                      <DoneLineView key={d.index} done={d} words={targets[d.index]} th={lines[d.index].th} />
                    ))}
                  </ol>
                  <button type="button" className="text-btn finish-early" onClick={() => finish(done)}>
                    จบตรงนี้และดูผล
                  </button>
                </>
              )}
            </div>
          )}

          {phase === "run" && view === "watch" && (
            <WatchList
              lines={lines}
              active={active}
              showTh={showTh}
              onPick={(i) => play(lines[i].start - 0.2)}
              onEnd={() => {
                playerRef.current?.pauseVideo();
                setPhase("setup");
              }}
            />
          )}

          {phase === "done" && (
            <Result
              done={done}
              total={lines.length}
              targets={targets}
              replays={replays}
              seconds={Math.max(1, Math.round((finishedAt - startedAt) / 1000))}
              previous={save.state === "saved" ? history.find((r) => r.mode === view && r !== save.result) : previous}
              save={save.state}
              onRetry={() => save.result && store(save.result)}
              onRestart={start}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CoverCheck({ cover, onChange }: { cover: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={cover} onChange={(e) => onChange(e.target.checked)} />
      บังขอบล่างของวิดีโอ (ถ้ามีเนื้อเพลงฝังอยู่ในภาพ)
    </label>
  );
}

// The line being typed, one box per word. Hidden words show only their
// length; finished words show the subtitle when right and what was typed when wrong.
function Slots({
  words,
  keys,
  input,
  showText,
}: {
  words: string[];
  keys: string[];
  input: string;
  showText: boolean;
}) {
  const parts = typedParts(input);
  const current = parts.length - 1;
  return (
    <p className="slots" lang="en" aria-hidden="true">
      {words.map((w, j) => {
        const typed = parts[j] ?? "";
        const size = { minWidth: `${keys[j].length + 1}ch` };
        if (j < current) {
          const ok = key(typed) === keys[j];
          return (
            <span key={j} className={`slot ${ok ? "is-ok" : "is-bad"}`} style={size}>
              {ok || showText ? w : typed}
            </span>
          );
        }
        if (j === current) {
          const prefix = key(typed);
          const onTrack = keys[j].startsWith(prefix);
          return (
            <span key={j} className={`slot is-current ${onTrack ? "" : "is-bad"}`} style={size}>
              {showText ? <Progress word={w} typed={onTrack ? prefix.length : 0} /> : typed}
            </span>
          );
        }
        return (
          <span key={j} className="slot is-todo" style={size}>
            {showText ? w : ""}
          </span>
        );
      })}
      {parts.slice(words.length, current).map((extra, j) => (
        <span key={`x${j}`} className="slot is-bad is-extra">
          {extra}
        </span>
      ))}
    </p>
  );
}

// A visible word with its first n letters marked as typed.
function Progress({ word, typed }: { word: string; typed: number }) {
  let seen = 0;
  let cut = 0;
  while (cut < word.length && seen < typed) {
    if (key(word[cut]) !== "") seen++;
    cut++;
  }
  return (
    <>
      <span className="slot-typed">{word.slice(0, cut)}</span>
      {word.slice(cut)}
    </>
  );
}

function DoneLineView({ done, words, th }: { done: DoneLine; words: string[]; th: string }) {
  return (
    <li className={done.skipped ? "is-skipped" : ""}>
      <p lang="en">
        {words.map((w, j) => (
          <span key={j} className={done.firstTry[j] ? "" : "is-missed"}>
            {w}{" "}
          </span>
        ))}
        {done.skipped && <span className="chip chip-fail">ข้าม</span>}
      </p>
      {th && <p className="done-th">{th}</p>}
    </li>
  );
}

function WatchList({
  lines,
  active,
  showTh,
  onPick,
  onEnd,
}: {
  lines: Video["lines"];
  active: number;
  showTh: boolean;
  onPick: (i: number) => void;
  onEnd: () => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[active] as HTMLElement | undefined;
    if (list && item)
      list.scrollTo({ top: item.offsetTop - list.offsetTop - list.clientHeight / 3, behavior: "smooth" });
  }, [active]);
  return (
    <div className="watch">
      <ol className="watch-lines" ref={listRef}>
        {lines.map((l, i) => (
          <li key={l.order} className={i === active ? "is-on" : ""}>
            <button type="button" onClick={() => onPick(i)} aria-current={i === active ? "true" : undefined}>
              <span lang="en">{l.en}</span>
              {showTh && l.th && <span className="done-th">{l.th}</span>}
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="secondary" onClick={onEnd}>
        เลิกดูและเลือกวิธีฝึก
      </button>
    </div>
  );
}

function Result({
  done,
  total,
  targets,
  replays,
  seconds,
  previous,
  save,
  onRetry,
  onRestart,
}: {
  done: DoneLine[];
  total: number;
  targets: string[][];
  replays: number;
  seconds: number;
  previous?: VideoResult;
  save: "idle" | "saving" | "saved" | "failed";
  onRetry: () => void;
  onRestart: () => void;
}) {
  const wordsTotal = done.reduce((n, d) => n + d.firstTry.length, 0);
  const correct = done.reduce((n, d) => n + d.firstTry.filter(Boolean).length, 0);
  const pct = percent(correct, wordsTotal);
  // Counted case-insensitively, shown as first written ("I", not "i").
  const missed = new Map<string, [string, number]>();
  for (const d of done) {
    d.firstTry.forEach((ok, j) => {
      const w = bare(targets[d.index][j]);
      const k = w.toLowerCase();
      if (!ok && w) missed.set(k, [missed.get(k)?.[0] ?? w, (missed.get(k)?.[1] ?? 0) + 1]);
    });
  }
  const missedList = [...missed.values()].sort((a, b) => b[1] - a[1]);

  if (done.length === 0) {
    return (
      <div className="quiz-end">
        <p>ยังไม่ได้ทำบรรทัดไหน จึงไม่มีผลให้บันทึก</p>
        <button type="button" className="primary" onClick={onRestart}>
          เริ่มใหม่
        </button>
      </div>
    );
  }

  return (
    <div className="quiz-end video-result">
      <div className="quiz-figures">
        <div>
          <p className="quiz-score">{pct}%</p>
          <p className="figure-label">
            คำที่ถูกตั้งแต่ครั้งแรก ({correct}/{wordsTotal})
          </p>
        </div>
        <div>
          <p className="quiz-score">
            {done.length}/{total}
          </p>
          <p className="figure-label">บรรทัด</p>
        </div>
        <div>
          <p className="quiz-score">{replays}</p>
          <p className="figure-label">ครั้งที่ฟังซ้ำ</p>
        </div>
        <div>
          <p className="quiz-score">{clock(seconds)}</p>
          <p className="figure-label">เวลา</p>
        </div>
      </div>

      {previous && (
        <p>
          ครั้งก่อน ({previous.date}) ถูก {percent(previous.wordsCorrect, previous.wordsTotal)}%{" "}
          {pct === percent(previous.wordsCorrect, previous.wordsTotal)
            ? "เท่าเดิม"
            : pct > percent(previous.wordsCorrect, previous.wordsTotal)
              ? `ครั้งนี้ดีขึ้น ${pct - percent(previous.wordsCorrect, previous.wordsTotal)}%`
              : `ครั้งนี้ลดลง ${percent(previous.wordsCorrect, previous.wordsTotal) - pct}%`}
        </p>
      )}

      {missedList.length > 0 ? (
        <section aria-labelledby="missed-words">
          <h3 id="missed-words">คำที่ยังฟังไม่ออก ({missedList.length} คำ)</h3>
          <p className="help">
            คำเล็ก ๆ อย่าง to, the, and, a มักถูกพูดเร็วและเบาจนกลืนกับคำข้างเคียง ถ้าพลาดคำพวกนี้บ่อย ลองฟังซ้ำด้วย
            0.75x
          </p>
          <p className="missed-words" lang="en">
            {missedList.map(([w, n]) => (
              <span key={w} className="chip">
                {w}
                {n > 1 ? ` ×${n}` : ""}
              </span>
            ))}
          </p>
        </section>
      ) : (
        <p>ฟังออกทุกคำตั้งแต่ครั้งแรก</p>
      )}

      <p className="help" role="status">
        {save === "saving" && "กำลังบันทึกผลลง Google Sheet"}
        {save === "saved" && "บันทึกผลลง Google Sheet แล้ว"}
        {save === "failed" && (
          <>
            บันทึกผลไม่สำเร็จ{" "}
            <button type="button" className="text-btn" onClick={onRetry}>
              ลองบันทึกอีกครั้ง
            </button>
          </>
        )}
      </p>

      <div className="quiz-actions">
        <button type="button" className="primary" onClick={onRestart}>
          ฝึกวิดีโอนี้อีกครั้ง
        </button>
        <a className="secondary link-button" href="#/video">
          เลือกวิดีโออื่น
        </a>
      </div>
    </div>
  );
}

function History({ history }: { history: VideoResult[] }) {
  return (
    <section aria-labelledby="video-history">
      <h3 id="video-history">ผลที่ผ่านมา</h3>
      <table className="quiz-topics">
        <thead>
          <tr>
            <th scope="col">วันที่</th>
            <th scope="col">วิธีฝึก</th>
            <th scope="col">ถูก</th>
            <th scope="col">บรรทัด</th>
            <th scope="col">เวลา</th>
          </tr>
        </thead>
        <tbody>
          {history.slice(0, 8).map((r, i) => (
            <tr key={i}>
              <td>
                {r.date} {r.time}
              </td>
              <td>{MODE_LABEL[r.mode] ?? r.mode}</td>
              <td>{percent(r.wordsCorrect, r.wordsTotal)}%</td>
              <td>
                {r.linesDone}/{r.linesTotal}
              </td>
              <td>{clock(r.seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
