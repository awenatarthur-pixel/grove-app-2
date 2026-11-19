import React, { useState, useEffect, useRef } from "react";
import { X, Check, BookOpen, Play, Pause, ChevronLeft, ChevronRight, ScrollText } from "lucide-react";

/* -------------------------------------------------------------------------
   Grove — optional Quest Log + Tour
   - Nothing here is forced. The guide only opens when the person taps the
     "Guide" button at the top of the Habits page, or taps "Take the tour" on
     the one-time welcome card (first-time users only).
   - Quest progress is worked out from the app's own state, plus a small
     "pages visited" list kept in this browser's localStorage.
------------------------------------------------------------------------- */

const VISITED_KEY = "grove_guide_visited";
const WELCOME_KEY = "grove_guide_welcome_seen";
const SEED_IDS = new Set(["p1", "p2", "p3", "n1", "n2"]);

function readLS(key, fallback) {
  try { const v = window.localStorage.getItem(key); return v === null ? fallback : v; } catch (err) { return fallback; }
}
function writeLS(key, value) {
  try { window.localStorage.setItem(key, value); } catch (err) {}
}

// Remembers which tabs the person has opened (used by the "look around" quests).
export function useVisitedPages(page) {
  const [visited, setVisited] = useState(() => {
    try { return JSON.parse(readLS(VISITED_KEY, "[]")); } catch (err) { return []; }
  });
  useEffect(() => {
    setVisited(prev => {
      if (prev.includes(page)) return prev;
      const next = [...prev, page];
      writeLS(VISITED_KEY, JSON.stringify(next));
      return next;
    });
  }, [page]);
  return visited;
}

// First-time users only: true until they dismiss the welcome card once.
export function useWelcomeCard() {
  const [show, setShow] = useState(() => readLS(WELCOME_KEY, "") !== "1");
  const dismiss = () => { writeLS(WELCOME_KEY, "1"); setShow(false); };
  return [show, dismiss];
}

/* ------------------------------ quests ---------------------------------- */

function buildQuests(state, visited) {
  const positive = state.positive || [];
  const negative = state.negative || [];
  const placedNew = (state.placedItems || []).filter(it => !String(it.id).startsWith("seed-")).length;
  const plannerCount = Object.values(state.plannerItems || {}).reduce((n, list) => n + (list?.length || 0), 0);
  const ownHabit = [...positive, ...negative].some(h => !SEED_IDS.has(h.id));
  const allDone = positive.length > 0 && positive.every(h => h.doneToday);
  const bestStreak = positive.reduce((m, h) => Math.max(m, h.streak || 0), 0);

  return [
    { id: "grove", emoji: "🌳", title: "Meet your grove", hint: "Open the Grove tab and see your world.", done: visited.includes("grove") },
    { id: "own", emoji: "✏️", title: "Add a habit of your own", hint: "On the Habits tab, tap “Add a habit”.", done: ownHabit },
    { id: "tick", emoji: "✅", title: "Complete every habit today", hint: "Tick today's box on each habit to earn the full daily bonus.", done: allDone },
    { id: "shop", emoji: "🛍️", title: "Buy something for your grove", hint: "Spend points in the Grove shop on a tree, animal or feature.", done: (state.unlocked || []).length > 1 || placedNew > 0 },
    { id: "grow", emoji: "🌱", title: "Place 3 new things in your grove", hint: "Drag items you've bought into your world.", done: placedNew >= 3 },
    { id: "plan", emoji: "📅", title: "Plan something in the Planner", hint: "Add a task to any day in the Planner tab.", done: plannerCount > 0 },
    { id: "progress", emoji: "📈", title: "Check your progress", hint: "Open the Progress tab to see your streaks and stats.", done: visited.includes("stats") },
    { id: "streak", emoji: "🔥", title: "Reach a 3-day streak", hint: "Keep one habit going three days in a row.", done: bestStreak >= 3 },
    { id: "env", emoji: "🌅", title: "Unlock a new environment", hint: "Save up points and change your grove's scenery.", done: (state.unlockedEnvs || []).length > 1 },
  ];
}

/* ------------------------------- tour ----------------------------------- */

const TOUR = [
  { emoji: "🌱", title: "Welcome to Grove", text: "Grove turns your daily habits into a living world. Every habit you keep helps your grove grow. This tour takes about a minute." },
  { emoji: "✅", title: "Habits tab", text: "Habits to grow sit at the top, and habits to break are below. Tap today's box to tick a habit off. Finish them all for a daily points bonus." },
  { emoji: "🔥", title: "Streaks", text: "Do a habit on consecutive days to build a streak. Tap any habit to see its full history and how consistent you've been." },
  { emoji: "🌳", title: "Your grove", text: "Points you earn can be spent on trees, animals and features. Drag them around your world and watch it fill up." },
  { emoji: "🐾", title: "Animals level up", text: "Link an animal to a habit and it levels up each time you complete that habit. Give it a name and watch it grow." },
  { emoji: "📅", title: "Planner & Progress", text: "Use the Planner to line up tasks for the week, and the Progress tab for your charts, streaks and stats." },
  { emoji: "🚀", title: "You're ready", text: "Open the Quest Log any time for small goals to try. There's no rush, and you can skip any of them." },
];

/* ------------------------------ UI bits --------------------------------- */

export function GuideButton({ onClick, doneCount, total, claimable = 0 }) {
  return (
    <button onClick={onClick} aria-label="Open guide" style={{
      display: "flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer",
      background: "var(--parchment-100)", color: "var(--forest-900)",
      padding: "7px 12px", borderRadius: 999, flexShrink: 0,
      fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13,
      boxShadow: "var(--shadow-card)",
    }}>
      <BookOpen size={14} strokeWidth={2.4} /> Guide
      {total > 0 && (
        <span style={{ background: "var(--forest-900)", color: "var(--gold-500)", borderRadius: 999, padding: "1px 7px", fontSize: 11 }}>
          {doneCount}/{total}
        </span>
      )}
      {claimable > 0 && (
        <span style={{ background: "var(--gold-500)", color: "var(--forest-950)", borderRadius: 999, padding: "1px 7px", fontSize: 11 }}>
          🎁 {claimable}
        </span>
      )}
    </button>
  );
}

// Small one-time card shown only to first-time users. Compact and easy to dismiss.
export function WelcomeCard({ onTour, onQuests, onDismiss }) {
  return (
    <div style={{
      position: "fixed", left: 12, right: 12, bottom: "calc(74px + env(safe-area-inset-bottom))",
      maxWidth: 560, margin: "0 auto", zIndex: 45,
      background: "var(--forest-900)", color: "var(--parchment-50)",
      borderRadius: 16, padding: "10px 12px", boxShadow: "var(--shadow-soft)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13, flex: 1, minWidth: 0 }}>New to Grove? 🌱</div>
      <button onClick={onTour} style={{
        border: "none", cursor: "pointer", borderRadius: 10, padding: "8px 11px",
        background: "var(--gold-500)", color: "var(--forest-950)", fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 12,
      }}>▶ Tour</button>
      <button onClick={onQuests} style={{
        border: "1px solid rgba(250,246,238,0.35)", cursor: "pointer", borderRadius: 10, padding: "7px 11px",
        background: "transparent", color: "var(--parchment-50)", fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 12,
      }}>Quests</button>
      <button onClick={onDismiss} aria-label="No thanks" style={{
        border: "none", background: "none", cursor: "pointer", color: "var(--moss-400)", display: "flex", padding: 4,
      }}><X size={16} /></button>
    </div>
  );
}

function TourPane() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const STEP_MS = 6000;
  const step = TOUR[i];
  const last = i === TOUR.length - 1;
  const timer = useRef(null);

  // Auto-advance while playing. Pausing or reaching the last step stops it.
  useEffect(() => {
    if (!playing || last) return;
    timer.current = setTimeout(() => setI(n => Math.min(TOUR.length - 1, n + 1)), STEP_MS);
    return () => clearTimeout(timer.current);
  }, [i, playing, last]);

  return (
    <div>
      <style>{`
        @keyframes grove-tour-pop { 0% { transform: scale(.7); opacity: 0; } 60% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes grove-tour-bar { from { width: 0%; } to { width: 100%; } }
        @keyframes grove-tour-text { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .grove-tour-anim { animation: none !important; } }
      `}</style>
      <div key={i} style={{ textAlign: "center", padding: "8px 4px 4px", minHeight: 210 }}>
        <div className="grove-tour-anim" style={{
          width: 96, height: 96, margin: "0 auto 12px", borderRadius: "50%", background: "var(--parchment-100)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 50,
          animation: "grove-tour-pop .5s ease-out",
        }}>{step.emoji}</div>
        <div className="grove-tour-anim" style={{ animation: "grove-tour-text .4s ease-out" }}>
          <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 22, color: "var(--forest-900)", margin: "0 0 8px" }}>{step.title}</h3>
          <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, lineHeight: 1.55, color: "var(--bark-900)", margin: 0 }}>{step.text}</p>
        </div>
      </div>

      {/* progress for the current step + step dots */}
      <div style={{ height: 4, background: "var(--parchment-100)", borderRadius: 4, overflow: "hidden", margin: "6px 0 10px" }}>
        {playing && !last
          ? <div key={`bar-${i}`} className="grove-tour-anim" style={{ height: "100%", background: "var(--gold-600)", animation: `grove-tour-bar ${STEP_MS}ms linear forwards` }} />
          : <div style={{ height: "100%", width: last ? "100%" : "0%", background: "var(--gold-600)" }} />}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 14 }}>
        {TOUR.map((_, n) => (
          <button key={n} onClick={() => setI(n)} aria-label={`Step ${n + 1}`} style={{
            width: n === i ? 18 : 8, height: 8, borderRadius: 8, border: "none", cursor: "pointer", padding: 0,
            background: n === i ? "var(--forest-900)" : "var(--moss-400)", opacity: n === i ? 1 : 0.5,
          }} />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <button onClick={() => { setPlaying(false); setI(n => Math.max(0, n - 1)); }} disabled={i === 0} aria-label="Previous" style={ctrlBtn(i === 0)}><ChevronLeft size={18} /></button>
        <button onClick={() => setPlaying(p => !p)} style={{
          ...ctrlBtn(false), width: "auto", padding: "0 18px", gap: 6, background: "var(--forest-900)", color: "var(--gold-500)",
          fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13,
        }}>
          {playing && !last ? <><Pause size={14} /> Pause</> : <><Play size={14} /> {last ? "Replay" : "Play"}</>}
        </button>
        <button onClick={() => {
          if (last) { setI(0); setPlaying(true); } else { setPlaying(false); setI(n => Math.min(TOUR.length - 1, n + 1)); }
        }} disabled={false} aria-label="Next" style={ctrlBtn(false)}>{last ? <Play size={16} /> : <ChevronRight size={18} />}</button>
      </div>
    </div>
  );
}

function ctrlBtn(disabled) {
  return {
    width: 44, height: 40, borderRadius: 12, border: "none", cursor: disabled ? "default" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "var(--parchment-100)", color: "var(--forest-900)", opacity: disabled ? 0.4 : 1,
  };
}

function QuestPane({ quests, claimed, reward, onClaim }) {
  const doneCount = quests.filter(q => q.done).length;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13, color: "var(--forest-900)" }}>
          {doneCount === quests.length ? "All quests complete! 🎉" : `${doneCount} of ${quests.length} complete`}
        </div>
      </div>
      <div style={{ height: 6, background: "var(--parchment-100)", borderRadius: 6, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ height: "100%", width: `${(doneCount / quests.length) * 100}%`, background: "var(--gold-600)", transition: "width .3s ease" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "46vh", overflowY: "auto", paddingRight: 2 }}>
        {quests.map(q => (
          <div key={q.id} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 14,
            background: q.done ? "rgba(132,169,140,0.18)" : "var(--parchment-100)",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: q.done ? "var(--forest-900)" : "var(--parchment-50)", color: "var(--gold-500)", fontSize: 14,
            }}>{q.done ? <Check size={15} strokeWidth={3} /> : q.emoji}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 14, color: "var(--forest-900)",
                textDecoration: q.done ? "line-through" : "none", opacity: q.done ? 0.65 : 1,
              }}>{q.title}</div>
              {!q.done && <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--moss-600)", marginTop: 2 }}>{q.hint}</div>}
            </div>
            <div style={{ marginLeft: "auto", flexShrink: 0 }}>
              {q.done && !claimed.includes(q.id) ? (
                <button onClick={() => onClaim(q.id)} style={{
                  border: "none", cursor: "pointer", borderRadius: 999, padding: "7px 12px",
                  background: "var(--gold-500)", color: "var(--forest-950)", fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 12,
                }}>Claim +{reward}</button>
              ) : q.done ? (
                <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 11, color: "var(--moss-600)" }}>Claimed ✓</span>
              ) : (
                <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 11, color: "var(--gold-600)" }}>+{reward}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// The guide itself: one panel with two tabs, Quest Log and Tour.
export function GuideModal({ tab, onTab, onClose, state, visited, claimed = [], reward = 300, onClaim = () => {} }) {
  const quests = buildQuests(state, visited);
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tabBtn = (id, label, Icon) => (
    <button onClick={() => onTab(id)} style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", border: "none", cursor: "pointer",
      borderRadius: 10, fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13,
      background: tab === id ? "var(--forest-900)" : "transparent", color: tab === id ? "var(--gold-500)" : "var(--forest-900)",
    }}><Icon size={14} /> {label}</button>
  );

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 80, background: "rgba(15,35,24,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Grove guide" style={{
        width: "100%", maxWidth: 440, background: "var(--parchment-50)", borderRadius: 22, padding: "18px 18px 20px",
        boxShadow: "var(--shadow-soft)", maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 22, color: "var(--forest-900)", margin: 0 }}>Grove guide</h2>
          <button onClick={onClose} aria-label="Close" style={{
            border: "none", background: "var(--parchment-100)", borderRadius: "50%", width: 32, height: 32, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fo
