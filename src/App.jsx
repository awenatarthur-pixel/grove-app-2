import React, { useState, useEffect, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "./useAuth";
import AuthPanel from "./AuthPanel";
import {
  ListChecks, Trees, BarChart2, Plus, Lock, X, Check, Flame,
  Sparkles, Heart, ShoppingBag, Trophy, UserPlus, Flower2, Crown,
  ChevronRight, Settings2, Droplets, ArrowLeft, TrendingUp, CalendarDays,
  Trash2, Share2, ListTodo, Sprout, RotateCcw, Lightbulb, Pencil
} from "lucide-react";

/* -------------------------------------------------------------------------
   GROVE — design tokens
   Palette: deep forest / moss / sunlight gold / dawn blush / parchment / bark
------------------------------------------------------------------------- */
// Uses Claude's artifact storage when running inside Claude, and falls back to
// the browser's own localStorage everywhere else (e.g. once deployed for real).
const groveStorage = (typeof window !== "undefined" && window.storage)
  ? window.storage
  : {
      get(key) {
        return new Promise((resolve, reject) => {
          try {
            const value = window.localStorage.getItem(key);
            if (value === null) { reject(new Error("not found")); return; }
            resolve({ key, value, shared: false });
          } catch (err) { reject(err); }
        });
      },
      set(key, value) {
        return new Promise((resolve, reject) => {
          try {
            window.localStorage.setItem(key, value);
            resolve({ key, value, shared: false });
          } catch (err) { reject(err); }
        });
      },
    };

const FONTS_LINK_ID = "grove-fonts";
function useFonts() {
  useEffect(() => {
    if (document.getElementById(FONTS_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONTS_LINK_ID;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
}

/* -------------------------------------------------------------------------
   Date + history helpers
------------------------------------------------------------------------- */
const WEEKDAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function startOfDay(d) { const c = new Date(d); c.setHours(0,0,0,0); return c; }
function isoDate(d) { return startOfDay(d).toISOString().slice(0,10); }
function lastNDates(n, endDate) {
  const end = startOfDay(endDate || new Date());
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    arr.push(d);
  }
  return arr;
}
function seededHistory(len, weight, forceLast) {
  const arr = [];
  for (let i = 0; i < len; i++) arr.push(Math.random() < weight ? 1 : 0);
  if (forceLast !== undefined) arr[arr.length - 1] = forceLast ? 1 : 0;
  return arr;
}
function currentStreak(history) {
  let s = 0;
  for (let i = history.length - 1; i >= 0; i--) { if (history[i]) s++; else break; }
  return s;
}
function bestStreak(history) {
  let best = 0, cur = 0;
  for (const v of history) { if (v) { cur++; best = Math.max(best, cur); } else cur = 0; }
  return best;
}
function currentWeekDates() {
  // Monday-start week containing today
  const today = startOfDay(new Date());
  const dow = today.getDay(); // 0 Sun ... 6 Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(monday.getDate() + mondayOffset);
  return lastNDates(7, new Date(monday.getTime() + 6 * 86400000));
}
function weekSum(history) {
  const dates = lastNDates(history.length);
  const week = currentWeekDates();
  return week.reduce((sum, d) => {
    const iso = isoDate(d);
    const idx = dates.findIndex(dd => isoDate(dd) === iso);
    return sum + (idx >= 0 ? history[idx] : 0);
  }, 0);
}

function isoWeekdayToday() {
  const dow = new Date().getDay(); // 0 Sun ... 6 Sat
  return dow === 0 ? 7 : dow; // 1 Mon ... 7 Sun
}

const HISTORY_LEN = 28;

/* -------------------------------------------------------------------------
   Demo data
------------------------------------------------------------------------- */
const START_POSITIVE = [
  { id: "p1", name: "Drink water", streak: 4, doneToday: false, history: seededHistory(HISTORY_LEN, 0.75, false) },
  { id: "p2", name: "Read 10 pages", streak: 2, doneToday: true, history: seededHistory(HISTORY_LEN, 0.7, true) },
  { id: "p3", name: "Morning walk", streak: 7, doneToday: false, history: seededHistory(HISTORY_LEN, 0.8, false) },
];

const START_NEGATIVE = [
  { id: "n1", name: "No junk food", target: 4, history: seededHistory(HISTORY_LEN, 0.55, false) },
  { id: "n2", name: "No late nights", target: 5, history: seededHistory(HISTORY_LEN, 0.4, false) },
];

const FRIENDS = [
  { id: "f1", name: "Leon", note: "went to the gym 5 times this week", kudos: 3, avatar: "🏋️" },
  { id: "f2", name: "Mira", note: "hit a 12-day reading streak", kudos: 6, avatar: "📚" },
  { id: "f3", name: "Sam", note: "finally beat the late-night scrolling habit", kudos: 1, avatar: "🌙" },
];

const SHOP_ITEMS = [
  // --- Land (Meadow / Misty Forest / Sunset Cliffs) ---
  { id: "tree", label: "Tree", emoji: "🌳", cost: 60, type: "decor", world: "land" },
  { id: "waterfall", label: "Stream", emoji: "💦", cost: 220, type: "feature", world: "land" },
  { id: "pond", label: "Pond", emoji: "🪷", cost: 140, type: "feature", world: "land" },
  { id: "fox", label: "Fox", emoji: "🦊", cost: 120, type: "animal", world: "land" },
  { id: "dog", label: "Dog", emoji: "🐕", cost: 90, type: "animal", world: "land" },
  { id: "horse", label: "Horse", emoji: "🐴", cost: 180, type: "animal", world: "land" },
  { id: "fish", label: "Fish", emoji: "🐟", cost: 60, type: "animal", requires: "pond", world: "land" },
  { id: "lilypad", label: "Lily Pad", emoji: "🍃", cost: 120, type: "lilypad", requires: "pond", livesOn: "pond", world: "land" },
  { id: "frog-blue", label: "Frog (Blue & Black)", emoji: "🐸", cost: 300, type: "frog", requires: "lilypad", livesOn: "lilypad", colors: ["#2e6fbf", "#1a1a1a"], world: "land" },

  // --- Rainforest ---
  { id: "jungletree", label: "Jungle Tree", emoji: "🌴", cost: 150, type: "decor", world: "rainforest" },
  { id: "venusflytrap", label: "Venus Fly Trap", emoji: "🌿", cost: 140, type: "decor", world: "rainforest" },
  { id: "orchid", label: "Orchid", emoji: "🌺", cost: 110, type: "decor", world: "rainforest" },
  { id: "chameleon", label: "Chameleon", emoji: "🦎", cost: 200, type: "animal", world: "rainforest" },
  { id: "monkey", label: "Monkey", emoji: "🐒", cost: 220, type: "animal", world: "rainforest" },
  { id: "toucan", label: "Toucan", emoji: "🦜", cost: 170, type: "animal", world: "rainforest" },
  { id: "sloth", label: "Sloth", emoji: "🦥", cost: 210, type: "animal", world: "rainforest", requires: "jungletree", livesOn: "jungletree" },
  { id: "rain", label: "Rain", emoji: "🌧️", cost: 180, type: "feature", world: "rainforest" },

  // --- Underwater Cave ---
  { id: "coral", label: "Coral", emoji: "🪸", cost: 130, type: "decor", world: "cave" },
  { id: "kelp", label: "Kelp", emoji: "🌿", cost: 80, type: "decor", world: "cave" },
  { id: "treasurechest", label: "Treasure Chest", emoji: "💰", cost: 170, type: "decor", world: "cave" },
  { id: "clownfish", label: "Clownfish", emoji: "🐠", cost: 90, type: "animal", world: "cave" },
  { id: "angelfish", label: "Angelfish", emoji: "🐟", cost: 90, type: "animal", world: "cave" },
  { id: "pufferfish", label: "Pufferfish", emoji: "🐡", cost: 90, type: "animal", world: "cave" },
  { id: "turtle", label: "Sea Turtle", emoji: "🐢", cost: 180, type: "animal", world: "cave" },
  { id: "octopus", label: "Octopus", emoji: "🐙", cost: 260, type: "animal", world: "cave" },
];

const ENVIRONMENTS = [
  // --- Land world: the original 3 upgrades ---
  { id: "meadow", world: "land", label: "Meadow", icon: "🌾", cost: 0, sky: ["#bfe3c9", "#eef7d8"], ground: ["#8fbf7a", "#6fa363"] },
  { id: "mist", world: "land", label: "Misty Forest", icon: "🌫️", cost: 320, sky: ["#9fb8ad", "#dfe9e2"], ground: ["#8fbf7a", "#6fa363"] },
  { id: "sunset", world: "land", label: "Sunset Cliffs", icon: "🌅", cost: 500, sky: ["#f4a896", "#ffe3b0"], ground: ["#8fbf7a", "#6fa363"] },

  // --- Rainforest world: 3 pricier upgrades, each a distinct look ---
  { id: "rainforest-canopy", world: "rainforest", label: "Canopy", icon: "🌴", cost: 650, sky: ["#1d4a34", "#5f9e5c"], ground: ["#345c2a", "#1a3318"], effect: "fireflies" },
  { id: "rainforest-falls", world: "rainforest", label: "Waterfall Grove", icon: "🌺", cost: 950, sky: ["#0f3d33", "#7bbf6e"], ground: ["#3f7a3a", "#204d24"], effect: "fireflies" },
  { id: "rainforest-ruins", world: "rainforest", label: "Ancient Ruins", icon: "🗿", cost: 1300, sky: ["#3c4a3f", "#8a9c86"], ground: ["#565f4e", "#2e352a"], effect: "fireflies" },

  // --- Underwater Cave world: 3 upgrades, each a distinct look ---
  { id: "cave", world: "cave", label: "Underwater Cave", icon: "🐙", cost: 800, sky: ["#0a3244", "#1f7a86"], ground: ["#d8cfa6", "#b7a978"], effect: "bubbles" },
  { id: "cave-reef", world: "cave", label: "Coral Reef", icon: "🪸", cost: 1100, sky: ["#0e4a5c", "#3fa8b5"], ground: ["#e0c9a0", "#c7a878"], effect: "bubbles" },
  { id: "cave-trench", world: "cave", label: "Abyssal Trench", icon: "🌑", cost: 1450, sky: ["#050f1a", "#12303f"], ground: ["#4a4438", "#2a2620"], effect: "bubbles" },
];

const WORLD_BY_ENV = Object.fromEntries(ENVIRONMENTS.map(e => [e.id, e.world]));
const WORLD_ORDER = ["land", "rainforest", "cave"];

const QUOTES = [
  "Small roots hold up tall trees.",
  "One skipped day doesn't fell a forest.",
  "The fog lifts the moment you show up.",
  "Every habit is a seed you already planted.",
  "Even bare branches are getting ready to bloom.",
  "Roots that reach deep hold branches that reach high.",
  "A garden grows one patient day at a time.",
  "Even in winter, the roots are still working.",
  "The seed doesn't rush the bloom.",
  "Growth is quiet before it's ever visible.",
  "Water what you want to grow.",
  "Weeds only win where nothing was planted on purpose.",
  "Every leaf started as a bud that didn't give up.",
  "The forest was once just a handful of seeds.",
  "Sunlight finds the parts of you still growing.",
  "Nothing blooms every day, and that's alright.",
  "A tree doesn't grow by worrying about the weather.",
  "Even the tallest oak was once a nut that held its ground.",
];

const SLIP_MESSAGES = [
  "Better luck tomorrow 🌱",
  "Tomorrow's a fresh start.",
  "One day doesn't undo the work.",
  "Shake it off, keep growing.",
];

const DAILY_QUOTES = [
  { text: "May your choices reflect your hopes, not your fears.", author: "Nelson Mandela" },
  { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
  { text: "Try not to become a person of success, but rather try to become a person of value.", author: "Albert Einstein" },
  { text: "It is not the strongest of the species that survive, but the one most responsive to change.", author: "Charles Darwin" },
  { text: "No one can make you feel inferior without your consent.", author: "Eleanor Roosevelt" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Courage is resistance to fear, mastery of fear — not absence of fear.", author: "Mark Twain" },
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
  { text: "Don't wish it were easier; wish you were better.", author: "Jim Rohn" },
  { text: "Many of life's failures are people who did not realize how close they were to success when they gave up.", author: "Thomas A. Edison" },
  { text: "What would you attempt to do if you knew you would not fail?", author: "Robert Schuller" },
  { text: "I've learned that people will never forget how you made them feel.", author: "Maya Angelou" },
  { text: "Focus on the journey, not the destination. Joy is found not in finishing an activity but in doing it.", author: "Greg Anderson" },
  { text: "You never regret being kind.", author: "Nicole Shepherd" },
  { text: "Think of what you have rather than of what you lack.", author: "Marcus Aurelius" },
  { text: "Happiness is where we find it, but very rarely where we seek it.", author: "J. Petit Senn" },
  { text: "To be content means that you realize you contain what you seek.", author: "Alan Cohen" },
  { text: "Keep your fears to yourself, but share your courage with others.", author: "Robert Louis Stevenson" },
  { text: "You have to be burning with an idea, or a problem, or a wrong you want to right.", author: "Steve Jobs" },
  { text: "You get in life what you have the courage to ask for.", author: "Nancy D. Solomon" },
  { text: "In the end, we cannot become what we need to be by remaining what we are.", author: "Max De Pree" },
  { text: "Wisdom equals knowledge plus courage.", author: "Jarod Kintz" },
  { text: "Leadership is an action, not a position.", author: "Donald McGannon" },
  { text: "If you spend your life trying to be good at everything, you will never be great at anything.", author: "Tom Rath" },
  { text: "Feeling gratitude and not expressing it is like wrapping a present and not giving it.", author: "William Arthur Ward" },
  { text: "Low self-confidence isn't a life sentence. It can be learned, practiced, and mastered.", author: "Barrie Davenport" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Do it or not. There is no try.", author: "Yoda" },
  { text: "You wouldn't worry so much about what others think of you if you realized how seldom they do.", author: "Eleanor Roosevelt" },
  { text: "The question isn't who is going to let me; it's who is going to stop me.", author: "Ayn Rand" },
];
function dailyQuoteOfDay() {
  const start = new Date(2024, 0, 1);
  const days = Math.floor((startOfDay(new Date()) - start) / 86400000);
  const idx = ((days % DAILY_QUOTES.length) + DAILY_QUOTES.length) % DAILY_QUOTES.length;
  return DAILY_QUOTES[idx];
}

const BONUS_CATEGORIES = {
  social: {
    label: "Social anxiety",
    icon: "😊",
    objectives: [
      "Compliment a stranger today",
      "Make eye contact and say hello to someone new",
      "Strike up a small conversation with a stranger",
      "Ask a question out loud in a group conversation",
      "Introduce yourself to someone you don't know",
      "Order something at a counter without rehearsing it first",
      "Sit somewhere visible in public, alone, and just be",
      "Say no to something without over-explaining",
    ],
  },
  mindfulness: {
    label: "Mindfulness",
    icon: "🧘",
    objectives: [
      "Journal for 5 minutes about how today felt",
      "Sit somewhere quiet for 10 minutes — no phone",
      "Take a slow walk and notice five things you can see",
      "Do 3 minutes of deep, deliberate breathing",
      "Eat one meal without any screens",
      "Write down three things you're grateful for",
      "Do a short body scan before bed",
      "Spend 5 minutes stretching without rushing",
    ],
  },
  discipline: {
    label: "Discipline",
    icon: "🎯",
    objectives: [
      "Stay off your phone for the last hour before bed",
      "Make your bed within 10 minutes of waking up",
      "No snacking after dinner tonight",
      "Wake up at the time you planned — no snoozing",
      "Finish one task you've been putting off",
      "Have a no-spend day today",
      "Prep tomorrow's outfit or bag tonight",
      "Put your phone in another room while you work",
    ],
  },
};
function dailyBonusObjective(categoryKey) {
  const category = BONUS_CATEGORIES[categoryKey] || BONUS_CATEGORIES.social;
  const list = category.objectives;
  const start = new Date(2024, 0, 1);
  const days = Math.floor((startOfDay(new Date()) - start) / 86400000);
  const idx = ((days % list.length) + list.length) % list.length;
  return list[idx];
}

const FREE_POSITIVE_LIMIT = 3;
const FREE_NEGATIVE_LIMIT = 2;
const FREE_PLANNER_PER_DAY = 2;
const PRO_PLANNER_PER_DAY = 8;
const PRO_PRICE = "£4";
const PRO_PLANS = [
  { id: "monthly", label: "Monthly", price: "£4", sub: "per month", badge: null },
  { id: "yearly", label: "Yearly", price: "£32", sub: "per year", badge: "Best value" },
  { id: "lifetime", label: "Lifetime", price: "£30", sub: "one-time — limited offer", badge: "First minute only" },
];
const SHINY_BUNDLES = [
  { id: "b3", amount: 3, price: "£0.99" },
  { id: "b6", amount: 6, price: "£1.79" },
  { id: "b12", amount: 12, price: "£2.99" },
  { id: "b24", amount: 24, price: "£4.99" },
];
const AI_ADVISER_COST = 3;
const LIFETIME_OFFER_MS = 60 * 1000;

/* -------------------------------------------------------------------------
   Small shared UI
------------------------------------------------------------------------- */
function TopBar({ title, right, onBack }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "18px 20px 12px", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {onBack && (
          <button onClick={onBack} style={{
            border: "none", background: "var(--parchment-100)", borderRadius: "50%",
            width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}><ArrowLeft size={16} color="var(--forest-900)" /></button>
        )}
        <h1 style={{
          fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26,
          color: "var(--forest-900)", margin: 0, letterSpacing: "-0.01em",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}

function PointsPill({ points }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, background: "var(--forest-900)",
      color: "var(--gold-500)", padding: "7px 13px", borderRadius: 999,
      fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 14,
      boxShadow: "var(--shadow-card)", flexShrink: 0,
    }}>
      <Sparkles size={14} strokeWidth={2.5} /> {points}
    </div>
  );
}

function SparksPill({ sparks }) {
  return (
    <div title="Sparks — earned by completing every habit in a day, spent on shiny animal skins" style={{
      display: "flex", alignItems: "center", gap: 5, background: "rgba(233,196,106,0.18)",
      color: "var(--gold-600)", padding: "6px 11px", borderRadius: 999,
      fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
      boxShadow: "var(--shadow-card)", flexShrink: 0, border: "1px solid rgba(212,168,74,0.35)",
    }}>
      ✨ {sparks}
    </div>
  );
}

function DragonIcon({ size = 40, accessory = "none" }) {
  return (
    <svg viewBox="0 0 44 44" width={size} height={size}>
      <defs>
        <linearGradient id="dragonBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c084e8" />
          <stop offset="100%" stopColor="#8a4fc9" />
        </linearGradient>
      </defs>
      <path d="M10,34 C4,36 2,30 6,28" stroke="#8a4fc9" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M8,22 C2,18 2,27 8,27 Z" fill="#d79cf0" opacity="0.9" />
      <path d="M36,22 C42,18 42,27 36,27 Z" fill="#d79cf0" opacity="0.9" />
      <ellipse cx="22" cy="27" rx="13" ry="11" fill="url(#dragonBody)" />
      <circle cx="22" cy="17" r="13" fill="url(#dragonBody)" />
      <path d="M14,7 L16,13 L11,12 Z" fill="#f4a5d8" />
      <path d="M30,7 L28,13 L33,12 Z" fill="#f4a5d8" />
      <ellipse cx="22" cy="30" rx="7" ry="6" fill="#ffe3f3" opacity="0.85" />
      <ellipse cx="13" cy="19" rx="2.6" ry="1.8" fill="#ff9ec7" opacity="0.6" />
      <ellipse cx="31" cy="19" rx="2.6" ry="1.8" fill="#ff9ec7" opacity="0.6" />
      <circle cx="16.5" cy="16" r="5.4" fill="#fff" />
      <circle cx="27.5" cy="16" r="5.4" fill="#fff" />
      <circle cx="17.3" cy="16.6" r="3.4" fill="#2b2033" />
      <circle cx="28.3" cy="16.6" r="3.4" fill="#2b2033" />
      <circle cx="18.6" cy="15" r="1.1" fill="#fff" />
      <circle cx="29.6" cy="15" r="1.1" fill="#fff" />
      <path d="M18,23 C20,25.5 24,25.5 26,23" stroke="#5a2e73" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <circle cx="20" cy="21.3" r="0.6" fill="#5a2e73" />
      <circle cx="24" cy="21.3" r="0.6" fill="#5a2e73" />
      {accessory === "scuba" && (
        <>
          <path d="M9,15 C9,10 35,10 35,15 L35,19 C35,22 9,22 9,19 Z" fill="rgba(255,255,255,0.18)" stroke="#2b6f8f" strokeWidth="1.6" />
          <line x1="9" y1="16" x2="2" y2="14" stroke="#2b6f8f" strokeWidth="1.6" />
          <line x1="35" y1="16" x2="42" y2="14" stroke="#2b6f8f" strokeWidth="1.6" />
        </>
      )}
      {accessory === "safari" && (
        <>
          <ellipse cx="22" cy="8" rx="13" ry="3" fill="#d8a552" />
          <path d="M14,8 C14,2 30,2 30,8 Z" fill="#e0b568" />
          <rect x="14" y="6.3" width="16" height="2" fill="#a9762f" />
        </>
      )}
    </svg>
  );
}

function ProBadge() {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4, background: "var(--gold-500)",
      color: "var(--bark-900)", padding: "3px 9px", borderRadius: 999,
      fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: "0.03em",
    }}><Crown size={11} strokeWidth={2.5} /> PRO</div>
  );
}

function SectionLabel({ label, icon, sub }) {
  return (
    <div style={{ padding: "14px 20px 10px" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, color: "var(--moss-600)",
        fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>{icon}{label}</div>
      {sub && <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--bark-700)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function AddRow({ label, locked, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      padding: "13px 16px", borderRadius: 16, border: "1.5px dashed var(--moss-400)",
      background: "transparent", color: "var(--moss-600)", cursor: "pointer",
      fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 14, width: "100%",
    }}>
      {locked ? <Lock size={14} /> : <Plus size={14} />} {label}
    </button>
  );
}

function WeekStrip({ habit, onToggleDay, restrictToToday = true }) {
  const week = currentWeekDates(); // Monday first
  const dates = lastNDates(habit.history.length);
  const todayIso = isoDate(new Date());
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {week.map(d => {
        const iso = isoDate(d);
        const idx = dates.findIndex(dd => isoDate(dd) === iso);
        const val = idx >= 0 ? habit.history[idx] : 0;
        const isFuture = iso > todayIso;
        const isPast = iso < todayIso;
        const isToday = iso === todayIso;
        const disabled = restrictToToday ? !isToday : isFuture;
        return (
          <button
            key={iso}
            disabled={disabled}
            onClick={() => onToggleDay(iso)}
            title={disabled ? `${iso} — future days can't be adjusted` : (restrictToToday ? iso : `${iso} — tap to toggle`)}
            style={{
              flex: 1, aspectRatio: "1", borderRadius: 9, minWidth: 0,
              border: isToday ? "2px solid var(--gold-600)" : "2px solid transparent",
              background: val ? "var(--moss-600)" : "var(--parchment-100)",
              opacity: disabled ? (isPast ? 1 : 0.45) : 1, cursor: disabled ? "default" : "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
              transition: "all .15s ease",
            }}>
            <span style={{
              fontSize: 9, fontWeight: 700, fontFamily: "'Manrope', sans-serif",
              color: val ? "rgba(255,255,255,0.85)" : "var(--bark-700)",
            }}>{WEEKDAY_SHORT[d.getDay()].slice(0, 1)}</span>
            {val ? <Check size={11} color="#fff" strokeWidth={3} /> : null}
          </button>
        );
      })}
    </div>
  );
}

function pillBtnStyle(positive) {
  return {
    flex: 1, padding: "8px 10px", borderRadius: 10, border: "none", cursor: "pointer",
    fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
    background: positive ? "rgba(82,121,111,0.12)" : "rgba(233,196,106,0.22)",
    color: positive ? "var(--moss-600)" : "var(--gold-600)",
  };
}

/* -------------------------------------------------------------------------
   PAGE 1 — Habit Tracker
------------------------------------------------------------------------- */
function HabitTracker({ state, actions }) {
  const { positive, negative, points, pro } = state;
  const [adding, setAdding] = useState(null); // 'positive' | 'negative' | null
  const [draft, setDraft] = useState("");
  const [editingTarget, setEditingTarget] = useState(null);
  const [slipMsg, setSlipMsg] = useState({}); // { [habitId]: message }
  const [editingHabit, setEditingHabit] = useState(null); // { kind, id, name }

  const submitAdd = () => {
    if (!draft.trim()) return;
    if (adding === "positive") actions.addHabit("positive", draft.trim());
    else actions.addHabit("negative", draft.trim());
    setDraft("");
    setAdding(null);
  };

  const submitEdit = () => {
    if (!editingHabit) return;
    actions.editHabit(editingHabit.kind, editingHabit.id, editingHabit.name);
    setEditingHabit(null);
  };

  const slip = (id) => {
    const msg = SLIP_MESSAGES[Math.floor(Math.random() * SLIP_MESSAGES.length)];
    setSlipMsg(m => ({ ...m, [id]: msg }));
    setTimeout(() => setSlipMsg(m => { const c = { ...m }; delete c[id]; return c; }), 2200);
  };

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar title="Your habits" right={<PointsPill points={points} />} />

      {!pro && (
        <div onClick={actions.openPaywall} style={{
          margin: "0 20px 18px", padding: "14px 16px", borderRadius: 16,
          background: "linear-gradient(120deg, var(--forest-800), var(--moss-600))",
          color: "var(--parchment-50)", display: "flex", alignItems: "center",
          justifyContent: "space-between", cursor: "pointer", boxShadow: "var(--shadow-soft)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Crown size={18} color="var(--gold-500)" />
            <div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 14 }}>Go unlimited with Pro</div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, opacity: 0.85 }}>{PRO_PRICE}/month · cancel anytime</div>
            </div>
          </div>
          <ChevronRight size={18} />
        </div>
      )}

      {/* Positive habits */}
      <SectionLabel label="Habits to grow" icon={<Trees size={14} />} sub="Only today's box can be ticked · complete all for +30 pts, each miss costs 6" />
      <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 10, alignItems: "start" }}>
        {positive.map(h => (
          <div key={h.id} style={{
            background: "var(--parchment-50)", borderRadius: 16, padding: "14px 16px",
            boxShadow: "var(--shadow-card)",
          }}>
            <div onClick={() => actions.openHabitDetail(h.id)} style={{
              display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 10,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--forest-900)" }}>{h.name}</div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--moss-600)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Flame size={12} /> {h.streak}-day streak
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); setEditingHabit({ kind: "positive", id: h.id, name: h.name }); }} style={{
                border: "none", background: "none", cursor: "pointer", color: "var(--moss-400)", display: "flex", flexShrink: 0,
              }}><Pencil size={14} /></button>
              <button onClick={e => { e.stopPropagation(); actions.deleteHabit("positive", h.id); }} style={{
                border: "none", background: "none", cursor: "pointer", color: "var(--blush-500)", display: "flex", flexShrink: 0,
              }}><Trash2 size={14} /></button>
              <TrendingUp size={16} color="var(--moss-400)" style={{ flexShrink: 0 }} />
            </div>
            <WeekStrip habit={h} onToggleDay={(iso) => actions.toggleDay(h.id, iso)} />
          </div>
        ))}
        <AddRow
          label={positive.length < FREE_POSITIVE_LIMIT || pro ? "Add a habit" : "Unlock more habits"}
          locked={positive.length >= FREE_POSITIVE_LIMIT && !pro}
          onClick={() => positive.length >= FREE_POSITIVE_LIMIT && !pro ? actions.openPaywall() : setAdding("positive")}
        />
      </div>

      {/* Negative habits */}
      <SectionLabel label="Habits to break" icon={<Droplets size={14} />} sub="+6 pts per clean habit today (max +24), −6 per slip · fog rolls in from Thursday if you miss target" />
      <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 10, alignItems: "start" }}>
        {negative.map(h => (
          <div key={h.id} style={{
            background: "var(--parchment-50)", borderRadius: 16, padding: "14px 16px",
            boxShadow: "var(--shadow-card)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--forest-900)", flex: 1, minWidth: 0 }}>{h.name}</div>
              <button onClick={() => setEditingHabit({ kind: "negative", id: h.id, name: h.name })} style={{
                border: "none", background: "none", cursor: "pointer", color: "var(--moss-400)", display: "flex", flexShrink: 0,
              }}><Pencil size={14} /></button>
              <button onClick={() => actions.deleteHabit("negative", h.id)} style={{
                border: "none", background: "none", cursor: "pointer", color: "var(--blush-500)", display: "flex", flexShrink: 0,
              }}><Trash2 size={14} /></button>
              <button onClick={() => setEditingTarget(editingTarget === h.id ? null : h.id)} style={{
                border: "none", background: "none", cursor: "pointer", color: "var(--moss-600)",
                display: "flex", alignItems: "center", flexShrink: 0,
              }}><Settings2 size={15} /></button>
            </div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--bark-700)", margin: "6px 0 8px" }}>
              {h.done}/{h.target} clean days this week — goal is {h.target}/7
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "var(--parchment-100)", overflow: "hidden", marginBottom: 10 }}>
              <div style={{
                height: "100%", width: `${Math.min(100, (h.done / h.target) * 100)}%`,
                background: h.done >= h.target ? "var(--moss-600)" : "var(--blush-500)",
                transition: "width .3s ease", borderRadius: 999,
              }} />
            </div>
            <WeekStrip habit={h} restrictToToday={false} onToggleDay={(iso) => {
              const dates = lastNDates(h.history.length);
              const idx = dates.findIndex(d => isoDate(d) === iso);
              const wasClean = idx >= 0 && h.history[idx] === 1;
              actions.toggleNegativeDay(h.id, iso);
              if (wasClean) slip(h.id);
            }} />
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--bark-700)", marginTop: 6 }}>
              Tap any day this week to mark it clean or slipped.
            </div>
            {slipMsg[h.id] && (
              <div style={{
                marginTop: 8, fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600,
                color: "var(--moss-600)", background: "rgba(82,121,111,0.1)", borderRadius: 10,
                padding: "7px 10px", animation: "grove-pop .2s ease-out",
              }}>🌱 {slipMsg[h.id]}</div>
            )}
            {editingTarget === h.id && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--bark-700)" }}>Weekly target:</span>
                <input type="range" min={1} max={7} value={h.target}
                  onChange={e => actions.setNegativeTarget(h.id, Number(e.target.value))}
                  style={{ flex: 1, accentColor: "var(--moss-600)" }} />
                <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12, color: "var(--forest-900)" }}>{h.target}/7</span>
              </div>
            )}
          </div>
        ))}
        <AddRow
          label={negative.length < FREE_NEGATIVE_LIMIT || pro ? "Add a habit to break" : "Unlock more habits"}
          locked={negative.length >= FREE_NEGATIVE_LIMIT && !pro}
          onClick={() => negative.length >= FREE_NEGATIVE_LIMIT && !pro ? actions.openPaywall() : setAdding("negative")}
        />
      </div>

      {adding && (
        <Modal onClose={() => setAdding(null)}>
          <h3 style={modalTitleStyle}>{adding === "positive" ? "New habit to grow" : "New habit to break"}</h3>
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submitAdd()}
            placeholder={adding === "positive" ? "e.g. Stretch for 5 minutes" : "e.g. No phone after 11pm"}
            style={inputStyle} />
          <button onClick={submitAdd} style={primaryBtnStyle}>Add habit</button>
        </Modal>
      )}

      {editingHabit && (
        <Modal onClose={() => setEditingHabit(null)}>
          <h3 style={modalTitleStyle}>Rename habit</h3>
          <input autoFocus value={editingHabit.name}
            onChange={e => setEditingHabit(h => ({ ...h, name: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && submitEdit()}
            style={inputStyle} />
          <button onClick={submitEdit} style={primaryBtnStyle}>Save</button>
        </Modal>
      )}

      <style>{`@keyframes grove-pop { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------
   PAGE 1b — Habit Detail (line graph + daily tick calendar)
------------------------------------------------------------------------- */
function HabitDetail({ habit, onBack }) {
  const dates = lastNDates(habit.history.length);
  const rolling = habit.history.map((_, i) => {
    const start = Math.max(0, i - 6);
    return habit.history.slice(start, i + 1).reduce((a, b) => a + b, 0);
  });
  const lineData = habit.history.map((v, i) => ({
    label: `${dates[i].getDate()}/${dates[i].getMonth() + 1}`,
    momentum: rolling[i],
  }));
  const totalTicks = habit.history.reduce((a, b) => a + b, 0);
  const completionRate = Math.round((totalTicks / habit.history.length) * 100);
  const best = bestStreak(habit.history);

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar title={habit.name} onBack={onBack} />

      <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Current streak", value: habit.streak, icon: <Flame size={14} /> },
          { label: "Best streak", value: best, icon: <TrendingUp size={14} /> },
          { label: "Completion", value: `${completionRate}%`, icon: <Sprout size={14} /> },
        ].map(stat => (
          <div key={stat.label} style={{
            background: "var(--parchment-50)", borderRadius: 14, padding: "12px 10px",
            boxShadow: "var(--shadow-card)", textAlign: "center",
          }}>
            <div style={{ display: "flex", justifyContent: "center", color: "var(--moss-600)", marginBottom: 4 }}>{stat.icon}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 20, color: "var(--forest-900)" }}>{stat.value}</div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, color: "var(--bark-700)" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ margin: "0 20px 16px", background: "var(--parchment-50)", borderRadius: 18, padding: "16px 16px 6px", boxShadow: "var(--shadow-card)" }}>
        <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 13, color: "var(--moss-600)", marginBottom: 6 }}>
          7-day momentum over the last {habit.history.length} days
        </div>
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--parchment-100)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontFamily: "Manrope", fontSize: 9, fill: "#6b4423" }} axisLine={false} tickLine={false} interval={3} />
            <YAxis domain={[0, 7]} allowDecimals={false} tick={{ fontFamily: "Manrope", fontSize: 11, fill: "#6b4423" }} axisLine={false} tickLine={false} width={20} />
            <Tooltip contentStyle={{ fontFamily: "Manrope", fontSize: 12, borderRadius: 10, border: "none", boxShadow: "var(--shadow-card)" }} labelFormatter={(l) => `Day ${l}`} formatter={(v) => [`${v}/7 days`, "Momentum"]} />
            <Line type="monotone" dataKey="momentum" stroke="var(--moss-600)" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <SectionLabel label="Daily history" icon={<CalendarDays size={14} />} sub="Every day you ticked this habit off, at a glance" />
      <div style={{ margin: "0 20px", background: "var(--parchment-50)", borderRadius: 18, padding: 14, boxShadow: "var(--shadow-card)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {habit.history.map((v, i) => {
            const isToday = i === habit.history.length - 1;
            return (
              <div key={i} title={isoDate(dates[i])} style={{
                aspectRatio: "1", borderRadius: 8, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 1,
                background: v ? "var(--moss-600)" : "var(--parchment-100)",
                border: isToday ? "2px solid var(--gold-600)" : "2px solid transparent",
              }}>
                <span style={{ fontSize: 9, fontFamily: "'Manrope', sans-serif", fontWeight: 700, color: v ? "rgba(255,255,255,0.85)" : "var(--bark-700)" }}>
                  {dates[i].getDate()}
                </span>
                {v ? <Check size={11} color="#fff" strokeWidth={3} /> : <span style={{ width: 11, height: 2, background: "var(--bark-700)", opacity: 0.3, borderRadius: 2 }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   PAGE 2 — The Grove
------------------------------------------------------------------------- */
function TheGrove({ state, actions }) {
  const [shopOpen, setShopOpen] = useState(false);
  const [shinyOpen, setShinyOpen] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteEmoji, setQuoteEmoji] = useState("🌱");
  const [hearts, setHearts] = useState([]);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  const env = ENVIRONMENTS.find(e => e.id === state.environment) || ENVIRONMENTS[0];
  const currentWorld = WORLD_BY_ENV[state.environment] || "land";
  const fogLevel = state.fogLevel; // 0-3
  const trees = state.placedItems.filter(it => it.type === "decor");

  const pet = (id, x, y, emoji) => {
    const quoteChance = fogLevel > 0 ? 0.9 : 0.35;
    if (Math.random() < quoteChance) {
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
      setQuoteEmoji(emoji || "🌱");
      setTimeout(() => setQuote(null), 2600);
    }
    const heartId = Math.random().toString(36).slice(2);
    setHearts(hs => [...hs, { id: heartId, x, y }]);
    setTimeout(() => setHearts(hs => hs.filter(h => h.id !== heartId)), 900);
  };

  const [draggingId, setDraggingId] = useState(null);
  const rafRef = useRef(null);
  const pendingPos = useRef(null);

  const onPointerDown = (id, e) => {
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (err) {}
    const rect = canvasRef.current.getBoundingClientRect();
    const item = state.placedItems.find(it => it.id === id);
    // Remember exactly where on the item you grabbed it, so it doesn't
    // snap to be centered under the cursor the moment you start dragging.
    let offsetX = 0, offsetY = 0;
    if (item) {
      const pointerXPct = ((e.clientX - rect.left) / rect.width) * 100;
      const pointerYPct = ((e.clientY - rect.top) / rect.height) * 100;
      offsetX = item.x - pointerXPct;
      offsetY = item.y - pointerYPct;
    }
    dragRef.current = { id, rect, type: item ? item.type : null, shopId: item ? item.shopId : null, offsetX, offsetY };
    setDraggingId(id);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    pendingPos.current = { clientX: e.clientX, clientY: e.clientY };
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (!dragRef.current || !pendingPos.current) return;
      const { id, rect, type, offsetX, offsetY } = dragRef.current;
      const { clientX, clientY } = pendingPos.current;
      let x = Math.min(94, Math.max(2, ((clientX - rect.left) / rect.width) * 100 + offsetX));
      let y = Math.min(88, Math.max(30, ((clientY - rect.top) / rect.height) * 100 + offsetY));

      if (type === "lilypad") {
        const pond = state.placedItems.find(it => it.type === "pond");
        if (pond) {
          // keep the lily pad inside the pond's water, not drifting onto the grass
          const pondHalfWidthPct = (130 / 2) * 0.75 / rect.width * 100;
          const pondHalfHeightPct = (46 / 2) * 0.75 / rect.height * 100;
          const dx = x - pond.x;
          const dy = y - pond.y;
          const nx = dx / pondHalfWidthPct;
          const ny = dy / pondHalfHeightPct;
          const dist = Math.sqrt(nx * nx + ny * ny);
          if (dist > 1) {
            x = pond.x + (dx / dist);
            y = pond.y + (dy / dist);
          }
        }
      }

      actions.movePlacedItem(id, x, y);
    });
  };
  const endDrag = () => {
    dragRef.current = null;
    pendingPos.current = null;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setDraggingId(null);
  };

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar title="The Grove" right={
        <div style={{ display: "flex", gap: 6 }}>
          <SparksPill sparks={state.sparks} />
          <PointsPill points={state.points} />
        </div>
      } />

      <div
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        style={{
          margin: "0 20px", height: 760, borderRadius: 24, position: "relative",
          overflow: "hidden", boxShadow: "var(--shadow-soft)",
          background: `linear-gradient(180deg, ${env.sky[0]} 0%, ${env.sky[1]} 55%, #d9cf9e 100%)`,
          touchAction: "none",
        }}
      >
        {/* sun, dimmed by fog — hidden in the underwater cave */}
        {env.effect !== "bubbles" && (
          <div style={{
            position: "absolute", top: 22, right: 30, width: 52, height: 52, borderRadius: "50%",
            background: "radial-gradient(circle, #fff4cf, var(--gold-500))",
            opacity: 1 - fogLevel * 0.28, filter: `blur(${fogLevel * 1.5}px)`,
            transition: "all .6s ease",
          }} />
        )}

        {/* drifting clouds, ambient — not interactive, hidden underwater */}
        {env.effect !== "bubbles" && [
          { top: "8%", size: 60, dur: 55, delay: 0 },
          { top: "16%", size: 44, dur: 70, delay: -20 },
          { top: "5%", size: 36, dur: 62, delay: -40 },
        ].map((c, i) => (
          <div key={i} style={{
            position: "absolute", top: c.top, left: "-20%", pointerEvents: "none",
            animation: `grove-drift ${c.dur}s linear infinite`, animationDelay: `${c.delay}s`,
          }}>
            <div style={{ position: "relative", width: c.size * 1.8, height: c.size * 0.6 }}>
              <div style={{ position: "absolute", left: 0, bottom: 0, width: c.size, height: c.size * 0.6, borderRadius: "50%", background: "rgba(255,255,255,0.75)" }} />
              <div style={{ position: "absolute", left: c.size * 0.45, bottom: c.size * 0.15, width: c.size * 0.75, height: c.size * 0.5, borderRadius: "50%", background: "rgba(255,255,255,0.8)" }} />
              <div style={{ position: "absolute", left: c.size * 0.9, bottom: 0, width: c.size * 0.6, height: c.size * 0.42, borderRadius: "50%", background: "rgba(255,255,255,0.7)" }} />
            </div>
          </div>
        ))}

        {/* soft light shaft, cave only — stands in for the missing sun */}
        {env.effect === "bubbles" && (
          <div style={{
            position: "absolute", top: -20, right: "18%", width: 90, height: 220,
            background: "linear-gradient(180deg, rgba(191,233,245,0.35), rgba(191,233,245,0))",
            transform: "skewX(-12deg)", pointerEvents: "none",
          }} />
        )}

        {/* rising bubbles, cave only */}
        {env.effect === "bubbles" && [
          { left: "12%", size: 8, dur: 5.5, delay: 0 },
          { left: "30%", size: 5, dur: 4.2, delay: -1.5 },
          { left: "52%", size: 7, dur: 6, delay: -3 },
          { left: "70%", size: 5, dur: 4.8, delay: -0.8 },
          { left: "85%", size: 9, dur: 5.2, delay: -2.4 },
        ].map((b, i) => (
          <div key={i} style={{
            position: "absolute", left: b.left, bottom: "4%", width: b.size, height: b.size,
            borderRadius: "50%", background: "rgba(210,240,250,0.55)",
            border: "1px solid rgba(255,255,255,0.4)", pointerEvents: "none",
            animation: `grove-bubble ${b.dur}s ease-in infinite`, animationDelay: `${b.delay}s`,
          }} />
        ))}

        {/* fireflies, jungle only */}
        {env.effect === "fireflies" && [
          { left: "20%", top: "38%", dur: 4.5, delay: 0 },
          { left: "42%", top: "28%", dur: 5.2, delay: -1.2 },
          { left: "64%", top: "40%", dur: 4.8, delay: -2.4 },
          { left: "78%", top: "26%", dur: 5.6, delay: -0.6 },
        ].map((f, i) => (
          <div key={i} style={{
            position: "absolute", left: f.left, top: f.top, width: 5, height: 5, borderRadius: "50%",
            background: "#f4e98a", boxShadow: "0 0 8px 3px rgba(244,233,138,0.8)", pointerEvents: "none",
            animation: `grove-firefly ${f.dur}s ease-in-out infinite`, animationDelay: `${f.delay}s`,
          }} />
        ))}

        {/* dense layered jungle canopy, rainforest only */}
        {currentWorld === "rainforest" && (
          <>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{
              position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none",
            }}>
              <path d="M0,0 L0,9 C6,13 12,6 18,10 C24,13 30,6 36,10 C42,13 48,6 54,10 C60,13 66,6 72,10 C78,13 84,6 90,10 C95,12 98,8 100,9 L100,0 Z"
                fill="#0b2013" opacity="0.9" />
              <path d="M0,0 L0,15 C8,20 14,10 22,16 C30,21 36,9 44,15 C52,20 58,9 66,15 C74,20 80,10 88,15 C94,18 98,12 100,15 L100,0 Z"
                fill="#153420" opacity="0.85" />
              <path d="M0,0 L0,24 C6,30 12,17 18,24 C24,30 30,15 36,23 C42,29 48,16 54,24 C60,29 66,16 72,23 C78,29 84,17 90,24 C94,27 98,19 100,22 L100,0 Z"
                fill="#1f4a2a" opacity="0.8" />
            </svg>

            {/* individual massive trees rising up through the canopy */}
            {[
              { left: "26%", top: "10%", height: "42%", trunkW: 10, canopyR: 36 },
              { left: "48%", top: "6%", height: "47%", trunkW: 13, canopyR: 42 },
              { left: "70%", top: "13%", height: "40%", trunkW: 9, canopyR: 32 },
            ].map((t, i) => (
              <div key={i} style={{
                position: "absolute", left: t.left, top: t.top, height: t.height, width: t.trunkW, pointerEvents: "none",
              }}>
                <div style={{
                  position: "absolute", bottom: 0, left: 0, width: "100%", height: "100%",
                  background: "linear-gradient(90deg, #1a120b, #3a291b 55%, #1a120b)", borderRadius: 4,
                }} />
                <div style={{
                  position: "absolute", top: -t.canopyR * 0.6, left: -(t.canopyR - t.trunkW) / 2,
                  width: t.canopyR, height: t.canopyR * 0.75, borderRadius: "50%",
                  background: "radial-gradient(circle at 35% 30%, #2f6b38, #163a1f)", opacity: 0.9,
                }} />
              </div>
            ))}

            {/* hanging vines drooping down from the canopy */}
            {[
              { left: "12%", height: 130, dur: 5, delay: 0 },
              { left: "34%", height: 95, dur: 6.2, delay: -1.4 },
              { left: "58%", height: 150, dur: 5.6, delay: -2.6 },
              { left: "80%", height: 105, dur: 6.6, delay: -0.8 },
              { left: "92%", height: 120, dur: 5.9, delay: -3.2 },
            ].map((v, i) => (
              <div key={i} style={{
                position: "absolute", left: v.left, top: 0, height: v.height, width: 14,
                transformOrigin: "top center",
                animation: `grove-vine-sway ${v.dur}s ease-in-out infinite`, animationDelay: `${v.delay}s`,
                pointerEvents: "none",
              }}>
                <svg viewBox="0 0 14 100" preserveAspectRatio="none" width="14" height="100%">
                  <path d="M7,0 C11,20 3,35 9,55 C12,68 4,80 7,100" stroke="#2f6b34" strokeWidth="1.6" fill="none" />
                </svg>
                {[18, 42, 68].map((topPct, j) => (
                  <div key={j} style={{
                    position: "absolute", left: j % 2 === 0 ? 8 : -2, top: `${topPct}%`, width: 10, height: 6,
                    borderRadius: "50%", background: "#3f8a44", transform: `rotate(${j % 2 === 0 ? 20 : -20}deg)`,
                  }} />
                ))}
              </div>
            ))}

            {/* massive tree trunks framing the sides */}
            <div style={{
              position: "absolute", left: 0, top: "3%", width: 22, height: "58%",
              background: "linear-gradient(90deg, #1a120b, #3a291b 60%, #1a120b)",
              borderRadius: "0 30% 30% 0", pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", right: 0, top: "1%", width: 26, height: "64%",
              background: "linear-gradient(270deg, #1a120b, #3a291b 60%, #1a120b)",
              borderRadius: "30% 0 0 30%", pointerEvents: "none",
            }} />

            {/* big foreground leaves framing the bottom corners */}
            <div style={{ position: "absolute", left: -16, bottom: -14, width: 0, height: 0, pointerEvents: "none" }}>
              {[-18, 8, 34, 58].map((deg, i) => (
                <div key={i} style={{
                  position: "absolute", left: 0, bottom: 0, width: 95, height: 34,
                  borderRadius: "0 100% 100% 0 / 0 100% 100% 0",
                  background: "linear-gradient(120deg, #245c30, #123018)",
                  transform: `rotate(${deg}deg)`, transformOrigin: "0% 100%", opacity: 0.92,
                }} />
              ))}
            </div>
            <div style={{ position: "absolute", right: -16, bottom: -14, width: 0, height: 0, pointerEvents: "none" }}>
              {[18, -8, -34, -58].map((deg, i) => (
                <div key={i} style={{
                  position: "absolute", right: 0, bottom: 0, width: 95, height: 34,
                  borderRadius: "100% 0 0 100% / 100% 0 0 100%",
                  background: "linear-gradient(240deg, #245c30, #123018)",
                  transform: `rotate(${deg}deg)`, transformOrigin: "100% 100%", opacity: 0.92,
                }} />
              ))}
            </div>
          </>
        )}

        {/* falling rain, rainforest only, once purchased and visible */}
        {currentWorld === "rainforest" && state.unlocked.includes("rain") && !state.hiddenFeatureIds.includes("rain") && (
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            {Array.from({ length: 22 }).map((_, i) => (
              <div key={i} style={{
                position: "absolute", top: -20, left: `${(i * 4.6) % 100}%`, width: 1.5, height: 16,
                background: "linear-gradient(180deg, rgba(210,235,245,0) 0%, rgba(210,235,245,0.55) 100%)",
                animation: `grove-rain ${0.6 + (i % 5) * 0.08}s linear infinite`,
                animationDelay: `${(i % 7) * 0.15}s`,
              }} />
            ))}
          </div>
        )}

        {/* rocky cave ceiling, underwater cave only */}
        {currentWorld === "cave" && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none",
          }}>
            <defs>
              <linearGradient id="caveRockGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#233a2c" />
                <stop offset="100%" stopColor="#3d5a46" />
              </linearGradient>
            </defs>
            <path d="M0,0 L100,0 L100,13 C94,19 89,9 83,16 C77,22 71,8 64,15 C57,21 51,7 44,14 C37,20 31,8 24,14 C17,20 11,9 5,15 C2,17 0,14 0,13 Z"
              fill="url(#caveRockGrad)" />
          </svg>
        )}

        {/* jagged rock formations along the floor and side walls, underwater cave only */}
        {currentWorld === "cave" && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none",
          }}>
            <defs>
              <linearGradient id="caveRockFloorGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5c6b58" />
                <stop offset="100%" stopColor="#33402e" />
              </linearGradient>
            </defs>
            {/* left wall rock formation */}
            <polygon points="0,72 4,58 9,64 13,52 18,60 20,50 24,68 24,80 0,80" fill="url(#caveRockFloorGrad)" opacity="0.9" />
            <polygon points="0,80 6,70 12,74 17,66 22,78 22,80" fill="#2a3524" opacity="0.6" />
            {/* right wall rock formation */}
            <polygon points="100,74 96,60 91,66 86,54 81,62 79,50 76,70 76,80 100,80" fill="url(#caveRockFloorGrad)" opacity="0.9" />
            <polygon points="100,80 94,71 88,75 83,67 78,79 78,80" fill="#2a3524" opacity="0.6" />
            {/* scattered rocks across the floor */}
            <polygon points="32,66 38,58 44,64 41,72 34,73" fill="#4a5846" opacity="0.85" />
            <polygon points="48,70 54,63 60,68 57,76 50,77" fill="#3d4a38" opacity="0.8" />
            <polygon points="63,64 68,57 74,62 71,70 65,71" fill="#4a5846" opacity="0.8" />
            {/* mossy highlights on the rocks */}
            <ellipse cx="38" cy="62" rx="3" ry="1.6" fill="#7a9463" opacity="0.5" />
            <ellipse cx="55" cy="67" rx="2.6" ry="1.4" fill="#7a9463" opacity="0.45" />
            <ellipse cx="69" cy="61" rx="2.4" ry="1.3" fill="#7a9463" opacity="0.45" />

            {/* coral accents */}
            <ellipse cx="8" cy="66" rx="7" ry="4" fill="#c96a8a" opacity="0.55" />
            <ellipse cx="16" cy="63" rx="5" ry="5.5" fill="#e0935f" opacity="0.5" />
            <ellipse cx="88" cy="65" rx="8" ry="4.5" fill="#7d5fa8" opacity="0.5" />
            <ellipse cx="94" cy="61" rx="5" ry="5" fill="#c96a8a" opacity="0.5" />
          </svg>
        )}

        {/* ground */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "48%",
          background: `linear-gradient(180deg, ${env.ground[0]} 0%, ${env.ground[1]} 100%)`,
        }} />

        {/* ambient fern clusters — decorative only, not draggable, rainforest only */}
        {currentWorld === "rainforest" && [
          { left: "5%", bottom: "5%", size: 34, flip: false },
          { left: "20%", bottom: "3%", size: 24, flip: true },
          { left: "40%", bottom: "6%", size: 30, flip: false },
          { left: "63%", bottom: "3%", size: 26, flip: true },
          { left: "82%", bottom: "6%", size: 32, flip: false },
          { left: "95%", bottom: "3%", size: 22, flip: true },
        ].map((f, i) => (
          <div key={i} style={{
            position: "absolute", left: f.left, bottom: f.bottom, pointerEvents: "none",
            width: f.size, height: f.size, transform: f.flip ? "scaleX(-1)" : "none",
          }}>
            {[-30, -10, 12, 32].map((deg, j) => (
              <div key={j} style={{
                position: "absolute", left: "50%", bottom: 0, width: f.size * 0.16, height: f.size * 0.8,
                background: "linear-gradient(180deg, #3f8a44, #1f4a26)",
                borderRadius: "0 100% 0 100%", transform: `translateX(-50%) rotate(${deg}deg)`,
                transformOrigin: "50% 100%",
              }} />
            ))}
          </div>
        ))}

        {/* sand ripples on the cave floor */}
        {currentWorld === "cave" && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none",
          }}>
            <path d="M0,90 C15,87 25,93 40,90 C55,87 65,93 80,90 C88,88 94,91 100,89" fill="none" stroke="#a89968" strokeWidth="1" opacity="0.5" />
            <path d="M0,96 C18,93 30,98 46,95 C60,92 72,98 86,95 C92,94 96,96 100,95" fill="none" stroke="#a89968" strokeWidth="1" opacity="0.45" />
          </svg>
        )}



        {/* small school of fish, ambient — cave only */}
        {currentWorld === "cave" && (
          <div style={{
            position: "absolute", left: "34%", top: "40%", pointerEvents: "none",
            animation: "grove-school-drift 9s ease-in-out infinite",
          }}>
            {[
              { dx: 0, dy: 0, size: 11, delay: 0 },
              { dx: 14, dy: -6, size: 9, delay: -0.4 },
              { dx: 26, dy: 3, size: 10, delay: -0.9 },
              { dx: 10, dy: 10, size: 8, delay: -1.3 },
              { dx: 34, dy: -4, size: 9, delay: -1.7 },
            ].map((f, i) => (
              <span key={i} style={{
                position: "absolute", left: f.dx, top: f.dy, fontSize: f.size, opacity: 0.85,
                animation: `grove-swim-small 2.4s ease-in-out infinite`, animationDelay: `${f.delay}s`,
              }}>🐟</span>
            ))}
          </div>
        )}

        {/* stream — a clean standalone diagonal across the ground, land world only; dry sand until purchased */}
        {currentWorld === "land" && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none",
          }}>
            <defs>
              <linearGradient id="riverWaterGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4f92ae" />
                <stop offset="55%" stopColor="#245a78" />
                <stop offset="100%" stopColor="#123a52" />
              </linearGradient>
            </defs>
            <path d="M-15,50 C-2,54 5,57 12,60 C32,68 52,79 70,88 C78,92 84,95 90,97"
              fill="none" strokeLinecap="round"
              stroke={state.unlocked.includes("waterfall") ? "url(#riverWaterGrad)" : "#cdb789"}
              strokeWidth={state.unlocked.includes("waterfall") ? 3.2 : 2.2}
              opacity={state.unlocked.includes("waterfall") ? 1 : 0.85}
              style={{ transition: "stroke .6s ease, stroke-width .6s ease" }}
            />
            {state.unlocked.includes("waterfall") && (
              <path d="M-15,50 C-2,54 5,57 12,60 C32,68 52,79 70,88 C78,92 84,95 90,97"
                fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.1} strokeLinecap="round"
                strokeDasharray="4 10" style={{ animation: "grove-river-flow 1.1s linear infinite" }} />
            )}
          </svg>
        )}

        {/* placed items: trees, animals & the pond — all draggable, scoped to the current world */}
        {state.placedItems.filter(item => item.type === "frienddragon" || (item.world || "land") === currentWorld).map(item => {
          if (item.type === "pond") {
            return (
              <div key={item.id} style={{
                position: "absolute", left: `${item.x}%`, top: `${item.y}%`,
                transform: "translate(-50%,-50%)", width: 130, height: 46,
              }}>
                <div
                  onPointerDown={e => onPointerDown(item.id, e)}
                  onClick={e => { e.stopPropagation(); const r = canvasRef.current.getBoundingClientRect(); pet(item.id, e.clientX - r.left, e.clientY - r.top, item.emoji); }}
                  style={{
                    width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden",
                    cursor: "grab", position: "relative",
                    background: "radial-gradient(ellipse at center, #4f92ae, #123a52)",
                    boxShadow: "inset 0 3px 8px rgba(0,0,0,0.15)",
                  }}>
                  {state.unlocked.includes("fish") && !state.hiddenFeatureIds.includes("fish") && (
                    <span style={{ position: "absolute", left: "20%", top: "40%", fontSize: 16, animation: "grove-swim 3.2s ease-in-out infinite" }}>🐟</span>
                  )}
                </div>
              </div>
            );
          }
          if (item.type === "lilypad") {
            return (
              <div key={item.id} style={{ position: "absolute", left: `${item.x}%`, top: `${item.y}%` }}>
                <div
                  onPointerDown={e => onPointerDown(item.id, e)}
                  onClick={e => { e.stopPropagation(); const r = canvasRef.current.getBoundingClientRect(); pet(item.id, e.clientX - r.left, e.clientY - r.top, item.emoji); }}
                  style={{
                    width: 44, height: 44, cursor: "grab",
                    transform: "translate(-50%,-50%)",
                    animation: "grove-float 3.4s ease-in-out infinite",
                  }}>
                  <svg viewBox="0 0 40 40" width="44" height="44">
                    <path d="M20,20 L20,3 A17,17 0 1 1 5,31 Z" fill="#5a9c4a" stroke="#3f7a34" strokeWidth="1.4" />
                    <path d="M20,20 L20,7" stroke="#3f7a34" strokeWidth="1" opacity="0.6" fill="none" />
                    <path d="M20,20 L10,26" stroke="#3f7a34" strokeWidth="0.8" opacity="0.5" fill="none" />
                  </svg>
                </div>
              </div>
            );
          }
          if (item.type === "frienddragon") {
            return (
              <div key={item.id} style={{ position: "absolute", left: `${item.x}%`, top: `${item.y}%` }}>
                <div
                  onPointerDown={e => onPointerDown(item.id, e)}
                  onClick={e => { e.stopPropagation(); const r = canvasRef.current.getBoundingClientRect(); pet(item.id, e.clientX - r.left, e.clientY - r.top, "🐲"); }}
                  style={{
                    width: 46, height: 46, cursor: "grab",
                    transform: "translate(-50%,-50%)",
                    animation: "grove-hop 2.6s ease-in-out infinite",
                    fontSize: 40, display: "flex", alignItems: "center", justifyContent: "center",
                    filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.18))", position: "relative",
                  }} title="A friendly dragon, earned by inviting a friend">
                  🐲
                  {currentWorld === "cave" && (
                    <>
                      <span style={{
                        position: "absolute", top: "20%", left: "44%", width: 4, height: 4, borderRadius: "50%",
                        background: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.4)",
                        pointerEvents: "none", animation: "grove-mini-bubble 2.2s ease-in infinite",
                      }} />
                      <span style={{
                        position: "absolute", top: "20%", left: "44%", width: 3, height: 3, borderRadius: "50%",
                        background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.3)",
                        pointerEvents: "none", animation: "grove-mini-bubble 2.6s ease-in infinite", animationDelay: "-1.1s",
                      }} />
                      <span style={{
                        position: "absolute", top: "20%", left: "44%", width: 2.5, height: 2.5, borderRadius: "50%",
                        background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.25)",
                        pointerEvents: "none", animation: "grove-mini-bubble 1.9s ease-in infinite", animationDelay: "-0.5s",
                      }} />
                    </>
                  )}
                </div>
              </div>
            );
          }
          if (item.type === "frog") {
            const [primary, accent] = item.colors || ["#4caf50", "#d64545"];
            return (
              <div key={item.id} style={{ position: "absolute", left: `${item.x}%`, top: `${item.y}%` }}>
                <div style={{
                  position: "absolute", left: "50%", top: 26, width: 26, height: 7,
                  background: "rgba(20,30,15,0.22)", borderRadius: "50%",
                  transform: "translateX(-50%)", filter: "blur(1.5px)",
                }} />
                <div
                  onPointerDown={e => onPointerDown(item.id, e)}
                  onClick={e => { e.stopPropagation(); const r = canvasRef.current.getBoundingClientRect(); pet(item.id, e.clientX - r.left, e.clientY - r.top, item.emoji); }}
                  style={{
                    width: 36, height: 36, cursor: "grab",
                    transform: "translate(-50%,-50%)",
                    animation: "grove-hop 1.5s ease-in-out infinite",
                  }}
                  title="Tap to pet"
                >
                  <svg viewBox="0 0 40 40" width="36" height="36">
                    <ellipse cx="20" cy="25" rx="14" ry="10" fill={primary} />
                    <circle cx="11" cy="12" r="6.5" fill={primary} />
                    <circle cx="29" cy="12" r="6.5" fill={primary} />
                    <circle cx="11" cy="12" r="3.2" fill="#fff" />
                    <circle cx="29" cy="12" r="3.2" fill="#fff" />
                    <circle cx="11" cy="12" r="1.5" fill="#111" />
                    <circle cx="29" cy="12" r="1.5" fill="#111" />
                    <ellipse cx="20" cy="27" rx="5.5" ry="3.2" fill={accent} opacity="0.85" />
                    <circle cx="12" cy="21" r="1.7" fill={accent} opacity="0.75" />
                    <circle cx="28" cy="21" r="1.7" fill={accent} opacity="0.75" />
                  </svg>
                </div>
              </div>
            );
          }
          if (item.shopId === "treasurechest") {
            return (
              <div key={item.id} style={{ position: "absolute", left: `${item.x}%`, top: `${item.y}%` }}>
                <div
                  onPointerDown={e => onPointerDown(item.id, e)}
                  onClick={e => { e.stopPropagation(); const r = canvasRef.current.getBoundingClientRect(); pet(item.id, e.clientX - r.left, e.clientY - r.top, item.emoji); }}
                  style={{ width: 70, height: 56, cursor: "grab", transform: "translate(-50%,-50%)" }}
                  title="Tap to pet"
                >
                  <svg viewBox="0 0 80 64" width="70" height="56">
                    <ellipse cx="40" cy="50" rx="34" ry="11" fill="#c9b686" />
                    <ellipse cx="40" cy="48" rx="30" ry="9" fill="#d8c89a" opacity="0.8" />
                    <path d="M18,44 L18,32 C18,29 21,27 24,27 L56,27 C59,27 62,29 62,32 L62,44 Z" fill="#6b4423" />
                    <rect x="18" y="40" width="44" height="4" fill="#4a2e18" />
                    <path d="M17,29 C17,20 24,15 40,15 C56,15 63,20 63,29 L58,30 C56,23 49,20 40,20 C31,20 24,23 22,30 Z" fill="#8a5a30" stroke="#4a2e18" strokeWidth="1" />
                    <ellipse cx="40" cy="28" rx="18" ry="6" fill="#ffe27a" opacity="0.85" />
                    {[[10,50],[16,54],[24,57],[34,58],[46,58],[56,56],[64,52],[70,47],[20,48],[52,49],[30,53],[44,54]].map(([cx, cy], i) => (
                      <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 4 : 3} fill="#f4c744" stroke="#c98f1f" strokeWidth="0.6" />
                    ))}
                    <circle cx="34" cy="30" r="4" fill="#ffdd66" stroke="#c98f1f" strokeWidth="0.6" />
                    <circle cx="44" cy="29" r="4.2" fill="#ffdd66" stroke="#c98f1f" strokeWidth="0.6" />
                    <circle cx="39" cy="26" r="3.6" fill="#fff0a8" stroke="#c98f1f" strokeWidth="0.6" />
                  </svg>
                </div>
                <span style={{
                  position: "absolute", left: "58%", top: "12%", fontSize: 14, pointerEvents: "none",
                  animation: "grove-sparkle-twinkle 1.8s ease-in-out infinite",
                }}>✨</span>
              </div>
            );
          }
          if (item.shopId === "venusflytrap") {
            return (
              <div key={item.id} style={{ position: "absolute", left: `${item.x}%`, top: `${item.y}%` }}>
                <div
                  onPointerDown={e => onPointerDown(item.id, e)}
                  onClick={e => { e.stopPropagation(); const r = canvasRef.current.getBoundingClientRect(); pet(item.id, e.clientX - r.left, e.clientY - r.top, item.emoji); }}
                  style={{
                    width: 54, height: 54, cursor: "grab",
                    transform: "translate(-50%,-50%)",
                    animation: "grove-sway 4.6s ease-in-out infinite",
                  }}
                  title="Tap to pet"
                >
                  <svg viewBox="0 0 40 40" width="54" height="54">
                    {/* stems */}
                    <path d="M20,38 L20,22" stroke="#2f6b34" strokeWidth="2.4" fill="none" strokeLinecap="round" />
                    <path d="M20,30 C16,26 13,22 10,18" stroke="#2f6b34" strokeWidth="2" fill="none" strokeLinecap="round" />
                    <path d="M20,27 C24,23 27,20 30,16" stroke="#2f6b34" strokeWidth="2" fill="none" strokeLinecap="round" />
                    {/* small side trap, left */}
                    <g transform="translate(9,15) rotate(-18) scale(0.62)" style={{ transformBox: "fill-box" }}>
                      <path d="M-10,1 C-10,-7 10,-7 10,1 C10,4.5 5,6.5 0,6.5 C-5,6.5 -10,4.5 -10,1 Z" fill="#4fae4f" stroke="#2f7a34" strokeWidth="0.8" />
                      <path d="M-8,0 C-8,-4.5 8,-4.5 8,0 C8,2.6 4,4 0,4 C-4,4 -8,2.6 -8,0 Z" fill="#c9495a" />
                      {[-8, -5, -2, 1, 4, 7].map(tx => (
                        <polygon key={tx} points={`${tx - 1},0.5 ${tx + 1},0.5 ${tx},-3`} fill="#eee7cf" />
                      ))}
                    </g>
                    {/* small side trap, right */}
                    <g transform="translate(29,13) rotate(18) scale(0.6)" style={{ transformBox: "fill-box" }}>
                      <path d="M-10,1 C-10,-7 10,-7 10,1 C10,4.5 5,6.5 0,6.5 C-5,6.5 -10,4.5 -10,1 Z" fill="#4fae4f" stroke="#2f7a34" strokeWidth="0.8" />
                      <path d="M-8,0 C-8,-4.5 8,-4.5 8,0 C8,2.6 4,4 0,4 C-4,4 -8,2.6 -8,0 Z" fill="#c9495a" />
                      {[-8, -5, -2, 1, 4, 7].map(tx => (
                        <polygon key={tx} points={`${tx - 1},0.5 ${tx + 1},0.5 ${tx},-3`} fill="#eee7cf" />
                      ))}
                    </g>
                    {/* main trap head, top */}
                    <g transform="translate(20,14)">
                      <path d="M-12,1 C-12,-8 12,-8 12,1 C12,5 6,7.5 0,7.5 C-6,7.5 -12,5 -12,1 Z" fill="#57b955" stroke="#2f7a34" strokeWidth="0.9" />
                      <path d="M-9.5,-0.5 C-9.5,-5.5 9.5,-5.5 9.5,-0.5 C9.5,3 4.5,4.6 0,4.6 C-4.5,4.6 -9.5,3 -9.5,-0.5 Z" fill="#d1505f" />
                      <ellipse cx="0" cy="0" rx="3" ry="1.6" fill="#a83a48" opacity="0.6" />
                      {[-9.5, -6.5, -3.5, -0.5, 2.5, 5.5, 8.5].map(tx => (
                        <polygon key={tx} points={`${tx - 1.3},0 ${tx + 1.3},0 ${tx},-4.2`} fill="#f2ecd6" />
                      ))}
                    </g>
                  </svg>
                </div>
              </div>
            );
          }
          const isAnimal = item.type === "animal";
          const isChameleon = item.shopId === "chameleon";
          const isSloth = item.shopId === "sloth";
          const isDraggingThis = draggingId === item.id;
          const isShiny = isAnimal && state.shinyUnlocked.includes(item.shopId) && !state.shinyHidden.includes(item.shopId);
          const size = item.shopId === "coral" ? 122 : item.shopId === "jungletree" ? 108 : item.type === "decor" ? 68 : 40;
          const animName = isSloth ? "grove-hang" : isAnimal ? "grove-roam" : "grove-sway";
          const animDur = isSloth ? 5.5 : (item.roamDuration || (isAnimal ? 5.5 : 4));

          // the sloth strictly follows its tree's position — no independent dragging, always attached
          let posX = item.x, posY = item.y;
          if (isSloth) {
            const tree = state.placedItems.find(it => it.shopId === "jungletree");
            if (tree) { posX = tree.x; posY = Math.max(8, tree.y - 14); }
          }

          return (
            <div key={item.id} style={{
              position: "absolute", left: `${posX}%`, top: `${posY}%`,
              transition: isDraggingThis ? "none" : "left .05s linear, top .05s linear", zIndex: isDraggingThis ? 5 : 1,
            }}>
              {/* a small branch for the sloth to hang from */}
              {isSloth && (
                <div style={{
                  position: "absolute", left: "50%", top: -3, width: 46, height: 5, borderRadius: 3,
                  background: "linear-gradient(90deg, #2b1d12, #4a3520 50%, #2b1d12)",
                  transform: "translateX(-50%) rotate(-3deg)", pointerEvents: "none",
                }} />
              )}
              {/* ground shadow for grounding — skipped for the sloth, which hangs up in the tree */}
              {isAnimal && !isSloth && (
                <div style={{
                  position: "absolute", left: "50%", top: size * 0.72, width: size * 0.7, height: size * 0.18,
                  background: "rgba(20,30,15,0.22)", borderRadius: "50%", transform: "translateX(-50%)",
                  filter: "blur(1.5px)", animation: isDraggingThis ? "none" : `grove-shadow ${animDur}s ease-in-out infinite`,
                }} />
              )}
              <div style={{
                position: "relative", width: size, height: size,
                transform: `translate(-50%,-50%) scale(${isDraggingThis ? 1.1 : 1})`,
                transition: "transform .12s ease-out",
              }}>
                <div
                  onPointerDown={isSloth ? undefined : (e => onPointerDown(item.id, e))}
                  onClick={e => { e.stopPropagation(); const r = canvasRef.current.getBoundingClientRect(); pet(item.id, e.clientX - r.left, e.clientY - r.top, item.emoji); }}
                  style={{
                    fontSize: size, cursor: isSloth ? "pointer" : "grab", userSelect: "none", touchAction: "none",
                    lineHeight: 1, position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    animation: isDraggingThis ? "none" : isChameleon
                      ? `${animName} ${animDur}s ease-in-out infinite, grove-chameleon-color 16s ease-in-out infinite`
                      : `${animName} ${animDur}s ease-in-out infinite`,
                    filter: isChameleon ? undefined : isShiny ? "hue-rotate(180deg) saturate(1.4) brightness(1.05)" : (fogLevel >= 2 ? "brightness(0.85) saturate(0.8) drop-shadow(0 3px 3px rgba(0,0,0,0.15))" : `drop-shadow(0 ${isDraggingThis ? 8 : 3}px ${isDraggingThis ? 8 : 3}px rgba(0,0,0,${isDraggingThis ? 0.28 : 0.15}))`),
                    "--roam": `${item.roamDistance || 26}px`,
                  }}
                  title={isSloth ? "Tap to pet — attached to its tree" : isAnimal ? "Tap to pet" : undefined}
                >
                  {item.emoji}
                </div>
              </div>
              {isShiny && (
                <span style={{
                  position: "absolute", left: "68%", top: "8%", fontSize: size * 0.32, pointerEvents: "none",
                  animation: "grove-sparkle-twinkle 1.6s ease-in-out infinite",
                }}>✨</span>
              )}
            </div>
          );
        })}

        {/* hearts on pet */}
        {hearts.map(h => (
          <div key={h.id} style={{
            position: "absolute", left: h.x, top: h.y, pointerEvents: "none",
            animation: "grove-heart 0.9s ease-out forwards", fontSize: 20,
          }}>💛</div>
        ))}

        {/* fog overlay */}
        {fogLevel > 0 && (
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: `linear-gradient(180deg, var(--fog-white) 0%, rgba(250,246,238,${0.12 * fogLevel}) 60%, transparent 100%)`,
            opacity: Math.min(1, fogLevel * 0.4), animation: "grove-fog 8s ease-in-out infinite alternate",
          }} />
        )}

        {/* motivational quote bubble */}
        {quote && (
          <div style={{
            position: "absolute", bottom: 14, left: 14, right: 14, background: "rgba(255,255,255,0.92)",
            borderRadius: 14, padding: "10px 14px", fontFamily: "'Manrope', sans-serif",
            fontSize: 13, color: "var(--forest-900)", fontWeight: 600, boxShadow: "var(--shadow-card)",
            animation: "grove-pop2 .25s ease-out",
          }}>{quoteEmoji} "{quote}"</div>
        )}
      </div>

      <div style={{ padding: "16px 20px 0", fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 11, color: "var(--moss-600)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {currentWorld === "rainforest" ? "Rainforest upgrades" : currentWorld === "cave" ? "Underwater Cave" : "Land upgrades"}
      </div>
      <div style={{ padding: "6px 20px 6px", display: "flex", gap: 8, overflowX: "auto" }}>
        {ENVIRONMENTS.filter(e => e.world === currentWorld).map(e => {
          const unlocked = state.unlockedEnvs.includes(e.id);
          return (
            <button key={e.id} onClick={() => unlocked ? actions.setEnvironment(e.id) : actions.buyEnvironment(e)} style={{
              flexShrink: 0, padding: "8px 14px", borderRadius: 999, border: "none", cursor: "pointer",
              fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
              background: state.environment === e.id ? "var(--forest-900)" : "var(--parchment-100)",
              color: state.environment === e.id ? "var(--gold-500)" : "var(--bark-700)",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {!unlocked && <Lock size={11} />} {e.icon} {e.label}{!unlocked && ` · ${e.cost}`}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "10px 20px 0" }}>
        <button onClick={() => setShopOpen(true)} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px 16px", borderRadius: 16, border: "none", cursor: "pointer",
          background: "var(--moss-600)", color: "#fff", fontFamily: "'Manrope', sans-serif",
          fontWeight: 700, fontSize: 14, boxShadow: "var(--shadow-card)",
        }}><ShoppingBag size={16} /> Grove shop</button>
      </div>

      <div style={{ padding: "10px 20px 0" }}>
        <button onClick={() => setShinyOpen(true)} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px 16px", borderRadius: 16, border: "1.5px solid rgba(212,168,74,0.4)", cursor: "pointer",
          background: "linear-gradient(120deg, rgba(233,196,106,0.16), rgba(236,138,114,0.12))",
          color: "var(--gold-600)", fontFamily: "'Manrope', sans-serif",
          fontWeight: 700, fontSize: 14,
        }}>✨ Shiny skins</button>
      </div>

      {shinyOpen && (
        <Modal onClose={() => setShinyOpen(false)}>
          <h3 style={modalTitleStyle}>Shiny skins</h3>
          <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--bark-700)", margin: "-8px 0 12px" }}>
            Give an animal you own a shimmering opposite-colored variant, paid for in Sparks — earned by completing your daily challenge (max 1 a day).
          </p>
          {(() => {
            const ownedAnimals = SHOP_ITEMS.filter(i => i.type === "animal" && i.world === currentWorld && state.unlocked.includes(i.id));
            if (ownedAnimals.length === 0) {
              return <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--bark-700)" }}>You don't own any animals in this world yet — buy one from the shop first.</p>;
            }
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ownedAnimals.map(a => {
                  const oppositeCost = 6;
                  const hasOpposite = state.shinyUnlocked.includes(a.id);
                  const isOn = hasOpposite && !state.shinyHidden.includes(a.id);
                  return (
                    <div key={a.id} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12,
                      background: "var(--parchment-100)",
                    }}>
                      <span style={{ fontSize: 24 }}>{a.emoji}</span>
                      <span style={{ flex: 1, fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 13, color: "var(--forest-900)" }}>{a.label}</span>
                      {hasOpposite ? (
                        <button onClick={() => actions.toggleShinyVisible(a.id)} style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, border: "none", cursor: "pointer",
                          background: isOn ? "var(--moss-600)" : "var(--parchment-50)",
                          color: isOn ? "#fff" : "var(--bark-700)",
                          fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 11,
                        }}>
                          <span style={{
                            width: 26, height: 15, borderRadius: 999, position: "relative", flexShrink: 0,
                            background: isOn ? "rgba(255,255,255,0.35)" : "var(--parchment-100)",
                          }}>
                            <span style={{
                              position: "absolute", top: 1.5, left: isOn ? 13 : 1.5, width: 12, height: 12, borderRadius: "50%",
                              background: isOn ? "#fff" : "var(--bark-700)", transition: "left .15s ease",
                            }} />
                          </span>
                          {isOn ? "Shiny on" : "Shiny off"}
                        </button>
                      ) : (
                        <button onClick={() => actions.buyShiny(a.id, oppositeCost)} disabled={state.sparks < oppositeCost} style={{
                          padding: "7px 11px", borderRadius: 10, border: "none",
                          cursor: state.sparks < oppositeCost ? "default" : "pointer",
                          background: "var(--forest-900)", color: "var(--gold-500)",
                          fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
                          opacity: state.sparks < oppositeCost ? 0.5 : 1,
                        }}>✨ {oppositeCost}</button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Modal>
      )}

      {shopOpen && (
        <Modal onClose={() => setShopOpen(false)}>
          <h3 style={modalTitleStyle}>
            {currentWorld === "rainforest" ? "Rainforest shop" : currentWorld === "cave" ? "Underwater shop" : "Grove shop"}
          </h3>
          <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--bark-700)", margin: "-8px 0 12px" }}>
            {currentWorld === "rainforest"
              ? "Switch to a land or underwater environment to see those shops."
              : currentWorld === "cave"
              ? "Switch environments up top to browse the land or rainforest shops."
              : "Rainforest and Underwater Cave have their own shops — switch environments up top to browse them."}
          </p>

          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 14, padding: "12px 14px",
            borderRadius: 14, background: "linear-gradient(120deg, rgba(233,196,106,0.18), rgba(236,138,114,0.14))",
            border: "1.5px solid rgba(212,168,74,0.35)",
          }}>
            <span style={{ fontSize: 34, display: "inline-block", animation: "quote-dragon-hop 2.6s ease-in-out infinite" }}>🐲</span>
            <style>{`@keyframes quote-dragon-hop { 0%,60%,100% { transform: translateY(0); } 80% { transform: translateY(-6px); } }`}</style>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 13, color: "var(--forest-900)" }}>Friendly Dragon</div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--bark-700)" }}>
                {state.placedItems.some(it => it.type === "frienddragon")
                  ? "Out in the grove — one dragon at a time"
                  : state.flowers > 0 ? `${state.flowers} earned from invites, ready to place` : "Invite a friend to earn one"}
              </div>
            </div>
            {state.placedItems.some(it => it.type === "frienddragon") ? (
              <button onClick={actions.removeDragon} style={{
                padding: "8px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "var(--blush-500)", color: "#fff",
                fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
              }}>Remove</button>
            ) : (
              <button onClick={actions.plantFlower} disabled={state.flowers <= 0} style={{
                padding: "8px 12px", borderRadius: 10, border: "none",
                cursor: state.flowers > 0 ? "pointer" : "default",
                background: state.flowers > 0 ? "var(--forest-900)" : "var(--parchment-100)",
                color: state.flowers > 0 ? "var(--gold-500)" : "var(--bark-700)",
                fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
                opacity: state.flowers > 0 ? 1 : 0.6,
              }}>Place one</button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {SHOP_ITEMS.filter(item => (item.world || "land") === currentWorld).map(item => {
              const owned = state.unlocked.includes(item.id);
              const hostLive = !item.livesOn || state.placedItems.some(p => p.shopId === item.livesOn);
              const hostLabel = SHOP_ITEMS.find(si => si.id === item.livesOn)?.label || item.livesOn;
              const liveReqMissing = item.livesOn && !hostLive;
              const disabledByReq = (item.requires && !state.unlocked.includes(item.requires)) || (owned && liveReqMissing);
              const draggableType = item.type === "decor" || (item.type === "animal" && item.id !== "fish") || item.id === "pond" || item.type === "lilypad" || item.type === "frog";
              const placedNow = draggableType && state.placedItems.some(p => p.shopId === item.id);
              const hiddenNow = !draggableType && state.hiddenFeatureIds.includes(item.id);
              let label;
              if (!owned) label = (item.requires && !state.unlocked.includes(item.requires)) ? `Needs ${item.requires}` : `${item.cost} pts`;
              else if (draggableType) {
                if (liveReqMissing && !placedNow) label = `Place a ${hostLabel} first`;
                else label = placedNow ? "Placed — tap to unplace" : "Tap to place";
              }
              else label = hiddenNow ? "Hidden — tap to show" : "Visible — tap to hide";
              return (
                <button key={item.id} disabled={disabledByReq && !placedNow}
                  onClick={() => actions.toggleShopItem(item)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    padding: "12px 8px", borderRadius: 14, border: "1px solid var(--parchment-100)",
                    background: owned ? "var(--parchment-100)" : "#fff",
                    cursor: disabledByReq && !placedNow ? "default" : "pointer",
                    opacity: disabledByReq && !placedNow ? 0.4 : 1,
                  }}>
                  <span style={{ fontSize: 26 }}>{item.emoji}</span>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12, color: "var(--forest-900)" }}>{item.label}</span>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--moss-600)", textAlign: "center" }}>{label}</span>
                </button>
              );
            })}
          </div>
          <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--bark-700)", marginTop: 12 }}>
            Drag anything in the grove to arrange it exactly how you like.
          </p>
        </Modal>
      )}

      <div style={{ padding: "18px 20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={actions.openFeedback} title="Suggest a new environment or report a bug" style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px 16px", borderRadius: 16, border: "none", cursor: "pointer",
          background: "var(--gold-500)", color: "var(--bark-900)",
          fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 14, boxShadow: "var(--shadow-card)",
        }}><Lightbulb size={16} /> Ideas & bugs</button>

        <button onClick={actions.openResetConfirm} title="Reset the grove back to its starting state" style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px 16px", borderRadius: 16, border: "1.5px solid var(--parchment-100)", cursor: "pointer",
          background: "transparent", color: "var(--bark-700)",
          fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 14,
        }}><RotateCcw size={16} /> Reset grove</button>

        <button onClick={actions.enterNewWorld} title="Move on to the next world — Land, then Rainforest, then Underwater Cave" style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px 16px", borderRadius: 16, border: "none", cursor: "pointer",
          background: "var(--forest-900)", color: "var(--gold-500)",
          fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 14, boxShadow: "var(--shadow-card)",
        }}><Sprout size={16} /> New world</button>
      </div>

      {state.showResetConfirm && (
        <Modal onClose={actions.closeResetConfirm}>
          <h3 style={modalTitleStyle}>Reset the grove?</h3>
          <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--forest-900)", lineHeight: 1.5 }}>
            This puts every habit, purchase, environment, planner entry, and shared update back to the starting demo state. This can't be undone.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={actions.closeResetConfirm} style={{ ...primaryBtnStyle, background: "var(--parchment-100)", color: "var(--bark-700)" }}>Cancel</button>
            <button onClick={actions.confirmReset} style={{ ...primaryBtnStyle, background: "var(--blush-500)", color: "#fff" }}>Reset everything</button>
          </div>
        </Modal>
      )}

      {state.showFeedback && (
        <Modal onClose={actions.closeFeedback}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Lightbulb size={20} color="var(--gold-600)" />
            <h3 style={{ ...modalTitleStyle, margin: 0 }}>Ideas & bug reports</h3>
          </div>
          <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--bark-700)", margin: "8px 0 12px" }}>
            Got an idea for a new environment, animal, or a bug you've spotted? Let us know below.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {[{ id: "idea", label: "💡 New idea" }, { id: "bug", label: "🐛 Bug fix" }].map(t => (
              <button key={t.id} onClick={() => actions.setFeedbackType(t.id)} style={{
                flex: 1, padding: "9px 10px", borderRadius: 12, border: "none", cursor: "pointer",
                fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
                background: state.feedbackType === t.id ? "var(--forest-900)" : "var(--parchment-100)",
                color: state.feedbackType === t.id ? "var(--gold-500)" : "var(--bark-700)",
              }}>{t.label}</button>
            ))}
          </div>
          <textarea
            value={state.feedbackDraft}
            onChange={e => actions.setFeedbackDraft(e.target.value)}
            placeholder={state.feedbackType === "idea" ? "e.g. A snowy tundra environment with penguins..." : "e.g. The fox sometimes wanders off the edge of the grove..."}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "'Manrope', sans-serif" }}
          />
          <button onClick={actions.submitFeedback} style={primaryBtnStyle}>Submit</button>
          <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--bark-700)", textAlign: "center", marginTop: 8 }}>
            Demo only — submissions are stored locally on this screen, not sent anywhere.
          </p>
          {state.feedbackSubmitted.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8, maxHeight: 160, overflowY: "auto" }}>
              {state.feedbackSubmitted.slice().reverse().map(f => (
                <div key={f.id} style={{
                  background: "var(--parchment-100)", borderRadius: 10, padding: "8px 10px",
                  fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--forest-900)",
                }}>
                  <strong>{f.type === "idea" ? "💡" : "🐛"}</strong> {f.text}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      <style>{`
        @keyframes grove-fall { 0% { background-position: 0 0; } 100% { background-position: 0 20px; } }
        @keyframes grove-drift { 0% { transform: translateX(0); } 100% { transform: translateX(700px); } }
        @keyframes grove-bubble {
          0% { transform: translate(0,0); opacity: 0; }
          10% { opacity: 0.9; }
          90% { opacity: 0.7; }
          100% { transform: translate(8px,-260px); opacity: 0; }
        }
        @keyframes grove-mini-bubble {
          0% { transform: translate(0,0); opacity: 0; }
          15% { opacity: 0.9; }
          100% { transform: translate(3px,-20px); opacity: 0; }
        }
        @keyframes grove-firefly {
          0%, 100% { transform: translate(0,0); opacity: 0.5; }
          25% { transform: translate(10px,-8px); opacity: 1; }
          50% { transform: translate(-6px,-14px); opacity: 0.4; }
          75% { transform: translate(-12px,4px); opacity: 0.9; }
        }
        @keyframes grove-chameleon-color {
          0% { filter: hue-rotate(0deg) saturate(1) drop-shadow(0 3px 3px rgba(0,0,0,0.15)); }
          33% { filter: hue-rotate(35deg) saturate(1.08) drop-shadow(0 3px 3px rgba(0,0,0,0.15)); }
          66% { filter: hue-rotate(-25deg) saturate(0.92) drop-shadow(0 3px 3px rgba(0,0,0,0.15)); }
          100% { filter: hue-rotate(0deg) saturate(1) drop-shadow(0 3px 3px rgba(0,0,0,0.15)); }
        }
        @keyframes grove-shiny-glow {
          0%, 100% { filter: hue-rotate(0deg) saturate(1.5) brightness(1.1) drop-shadow(0 0 6px rgba(233,196,106,0.8)); }
          50% { filter: hue-rotate(20deg) saturate(1.8) brightness(1.25) drop-shadow(0 0 10px rgba(233,196,106,1)); }
        }
        @keyframes grove-sparkle-twinkle {
          0%, 100% { opacity: 0.4; transform: scale(0.85) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.15) rotate(15deg); }
        }
        @keyframes grove-rain { 0% { transform: translateY(0); } 100% { transform: translateY(340px); } }
        @keyframes grove-vine-sway { 0%,100% { transform: rotate(-2.5deg); } 50% { transform: rotate(2.5deg); } }
        @keyframes grove-flutter {
          0%, 100% { transform: translate(0,0) rotate(0deg); }
          25% { transform: translate(14px,-10px) rotate(8deg); }
          50% { transform: translate(26px,2px) rotate(-4deg); }
          75% { transform: translate(10px,10px) rotate(6deg); }
        }
        @keyframes grove-mist { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes grove-river-flow { to { stroke-dashoffset: -28; } }
        @keyframes grove-swim { 0%,100% { transform: translateX(0); } 50% { transform: translateX(70px) scaleX(-1); } }
        @keyframes grove-swim-small { 0%,100% { transform: translateX(0); } 50% { transform: translateX(18px) scaleX(-1); } }
        @keyframes grove-school-drift {
          0%, 100% { transform: translate(0,0); }
          50% { transform: translate(40px,-10px); }
        }
        @keyframes grove-sway { 0%,100% { transform: translate(-50%,-50%) rotate(-2deg); } 50% { transform: translate(-50%,-50%) rotate(2deg); } }
        @keyframes grove-roam {
          0%   { transform: translate(calc(-50% - var(--roam)), -50%) scaleX(-1) translateY(0); }
          22%  { transform: translate(calc(-50% - var(--roam) * 0.2), -50%) scaleX(-1) translateY(-3px); }
          48%  { transform: translate(calc(-50% + var(--roam)), -50%) scaleX(1) translateY(0); }
          72%  { transform: translate(calc(-50% + var(--roam) * 0.2), -50%) scaleX(1) translateY(-3px); }
          100% { transform: translate(calc(-50% - var(--roam)), -50%) scaleX(-1) translateY(0); }
        }
        @keyframes grove-hang {
          0%, 100% { transform: translate(-50%,-50%) rotate(-4deg); }
          50% { transform: translate(-50%,-50%) rotate(4deg); }
        }
        @keyframes grove-shadow {
          0%   { transform: translateX(calc(-50% - var(--roam,26px))); opacity: 0.22; }
          50%  { transform: translateX(calc(-50% + var(--roam,26px))); opacity: 0.18; }
          100% { transform: translateX(calc(-50% - var(--roam,26px))); opacity: 0.22; }
        }
        @keyframes grove-heart { 0% { opacity: 1; transform: translateY(0) scale(0.8); } 100% { opacity: 0; transform: translateY(-40px) scale(1.3); } }
        @keyframes grove-float { 0%,100% { transform: translate(-50%,-50%) translateY(0); } 50% { transform: translate(-50%,-50%) translateY(-3px); } }
        @keyframes grove-hop {
          0%, 100% { transform: translate(-50%,-50%) translateY(0) scaleY(1); }
          25% { transform: translate(-50%,-50%) translateY(-9px) scaleY(1.08); }
          50% { transform: translate(-50%,-50%) translateY(0) scaleY(0.9); }
          75% { transform: translate(-50%,-50%) translateY(-5px) scaleY(1.04); }
        }
        @keyframes grove-fog { 0% { opacity: 0.5; } 100% { opacity: 1; } }
        @keyframes grove-pop2 { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------
   PAGE 3 — Progress: chart, streak, objectives, sharing, leaderboard
------------------------------------------------------------------------- */
function StatsPage({ state, actions }) {
  const weekDates = currentWeekDates();
  const chartData = weekDates.map((d) => {
    const iso = isoDate(d);
    const dayIdx = state.positive[0] ? state.positive[0].history.length : HISTORY_LEN;
    let completed = 0;
    state.positive.forEach(h => {
      const dates = lastNDates(h.history.length);
      const idx = dates.findIndex(dd => isoDate(dd) === iso);
      if (idx >= 0) completed += h.history[idx];
    });
    return { day: WEEKDAY_SHORT[d.getDay()], completed };
  });

  const best = Math.max(...state.positive.map(h => h.streak), 0);
  const [pulse, setPulse] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [confirmShare, setConfirmShare] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const doneCount = state.positive.filter(h => h.doneToday).length;
  const totalCount = state.positive.length;

  const invite = async () => {
    if (state.authUser) {
      const link = `${window.location.origin}/?ref=${state.authUser.id}`;
      try {
        await navigator.clipboard.writeText(link);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 3000);
      } catch (err) {
        window.prompt("Copy your invite link:", link);
      }
      return;
    }
    // signed out — local demo fallback
    actions.inviteFriend();
    setInviteSent(true);
    setTimeout(() => setInviteSent(false), 2400);
  };

  const shareText = `${doneCount}/${totalCount} objectives done today, ${best}-day best streak`;

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar title="Progress" right={state.pro ? <ProBadge /> : null} />

      <div style={{ margin: "0 20px 16px", background: "var(--parchment-50)", borderRadius: 18, padding: "16px 16px 6px", boxShadow: "var(--shadow-card)" }}>
        <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 13, color: "var(--moss-600)", marginBottom: 6 }}>Habits completed this week</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--parchment-100)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontFamily: "Manrope", fontSize: 11, fill: "#6b4423" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontFamily: "Manrope", fontSize: 11, fill: "#6b4423" }} axisLine={false} tickLine={false} width={20} />
            <Tooltip cursor={{ fill: "rgba(82,121,111,0.08)" }} contentStyle={{ fontFamily: "Manrope", fontSize: 12, borderRadius: 10, border: "none", boxShadow: "var(--shadow-card)" }} />
            <Bar dataKey="completed" radius={[6,6,0,0]} fill="var(--moss-600)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ margin: "0 20px 16px" }}>
        <button onClick={() => { setPulse(true); setTimeout(() => setPulse(false), 500); }} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: "16px", borderRadius: 18, border: "none", cursor: "pointer",
          background: "linear-gradient(120deg, var(--gold-600), var(--gold-500))",
          color: "var(--bark-900)", fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15,
          boxShadow: "var(--shadow-soft)", transform: pulse ? "scale(1.03)" : "scale(1)", transition: "transform .2s ease",
        }}>
          <Flame size={20} /> {best}-day best streak
        </button>
      </div>

      <SectionLabel label="Today's objectives" icon={<ListTodo size={14} />} sub={`${doneCount}/${totalCount} done — visible to friends only if you choose to share`} />
      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {state.positive.map(h => (
          <div key={h.id} onClick={() => actions.toggleToday(h.id)} style={{
            display: "flex", alignItems: "center", gap: 10, background: "var(--parchment-50)",
            borderRadius: 12, padding: "10px 12px", boxShadow: "var(--shadow-card)", cursor: "pointer",
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0,
              background: h.doneToday ? "var(--moss-600)" : "var(--parchment-100)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{h.doneToday && <Check size={13} color="#fff" strokeWidth={3} />}</div>
            <span style={{
              fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 13, color: "var(--forest-900)",
              textDecoration: h.doneToday ? "line-through" : "none", opacity: h.doneToday ? 0.6 : 1,
            }}>{h.name}</span>
          </div>
        ))}
        <button onClick={() => setConfirmShare(true)} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "12px 16px", borderRadius: 14, border: "none", cursor: "pointer",
          background: "rgba(82,121,111,0.12)", color: "var(--moss-600)",
          fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 13, marginTop: 2,
        }}><Share2 size={14} /> Share today's progress with friends</button>

        {state.sharedUpdates.length > 0 && (
          <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--bark-700)", padding: "2px 4px" }}>
            Last shared: "{state.sharedUpdates[state.sharedUpdates.length - 1].text}"
          </div>
        )}
      </div>

      <SectionLabel label="Bonus objective" icon={<Sparkles size={14} />} sub="A small daily push, your pick of focus — optional, +15 pts + 1 Spark" />
      <div style={{ padding: "0 20px 4px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {Object.entries(BONUS_CATEGORIES).map(([key, cat]) => (
            <button key={key} onClick={() => actions.setBonusCategory(key)} style={{
              flex: 1, padding: "8px 6px", borderRadius: 12, border: "none", cursor: "pointer",
              fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 11,
              background: state.bonusCategory === key ? "var(--forest-900)" : "var(--parchment-100)",
              color: state.bonusCategory === key ? "var(--gold-500)" : "var(--bark-700)",
            }}>{cat.icon} {cat.label}</button>
          ))}
        </div>
        <div onClick={actions.toggleBonusObjective} style={{
          display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
          background: "linear-gradient(120deg, rgba(233,196,106,0.18), rgba(236,138,114,0.14))",
          border: "1.5px solid rgba(212,168,74,0.35)", borderRadius: 16, padding: "14px 16px",
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            background: state.bonusDone ? "var(--gold-600)" : "#fff",
            border: "1.5px solid var(--gold-600)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{state.bonusDone && <Check size={15} color="#fff" strokeWidth={3} />}</div>
          <span style={{
            fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: 13, color: "var(--forest-900)",
            textDecoration: state.bonusDone ? "line-through" : "none", opacity: state.bonusDone ? 0.6 : 1,
          }}>{dailyBonusObjective(state.bonusCategory)}</span>
        </div>
      </div>

      <SectionLabel label="Leaderboard" icon={<Trophy size={14} />} />
      <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10, alignItems: "start" }}>
        {state.friends.map(f => (
          <div key={f.id} style={{
            background: "var(--parchment-50)", borderRadius: 16, padding: "12px 14px",
            display: "flex", alignItems: "center", gap: 10, boxShadow: "var(--shadow-card)",
          }}>
            <div style={{ fontSize: 24 }}>{f.avatar}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 14, color: "var(--forest-900)" }}>{f.name}</div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--bark-700)" }}>{f.note}</div>
            </div>
            <button onClick={() => actions.congratulate(f.id)} style={{
              display: "flex", alignItems: "center", gap: 4, border: "none", cursor: "pointer",
              background: "rgba(236,138,114,0.14)", color: "var(--blush-500)", borderRadius: 999,
              padding: "6px 10px", fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
            }}><Heart size={12} /> {f.kudos}</button>
          </div>
        ))}

        <button onClick={invite} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px 16px", borderRadius: 16, border: "1.5px dashed var(--moss-400)",
          background: "transparent", color: "var(--moss-600)", cursor: "pointer",
          fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 14,
        }}><UserPlus size={15} /> {state.authUser ? "Copy your invite link" : "Invite a friend"}</button>

        {linkCopied && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, background: "rgba(233,196,106,0.2)",
            borderRadius: 14, padding: "10px 14px", fontFamily: "'Manrope', sans-serif", fontSize: 12,
            color: "var(--bark-900)", fontWeight: 600,
          }}>
            🔗 Link copied! Send it to a friend — you'll earn a Friendly Dragon the moment they sign up.
          </div>
        )}

        {inviteSent && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, background: "rgba(233,196,106,0.2)",
            borderRadius: 14, padding: "10px 14px", fontFamily: "'Manrope', sans-serif", fontSize: 12,
            color: "var(--bark-900)", fontWeight: 600,
          }}>
            🐲 Invite sent — you earned a friendly dragon!
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--bark-700)", padding: "4px 2px" }}>
          🐲 {state.flowers} friendly dragon{state.flowers === 1 ? "" : "s"} collected
        </div>
      </div>

      {confirmShare && (
        <Modal onClose={() => setConfirmShare(false)}>
          <h3 style={modalTitleStyle}>Share with friends?</h3>
          <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--forest-900)", lineHeight: 1.5 }}>
            Your friends will see: <strong>"{shareText}"</strong>. Nothing is shared unless you confirm — you choose every time.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => setConfirmShare(false)} style={{ ...primaryBtnStyle, background: "var(--parchment-100)", color: "var(--bark-700)" }}>Not now</button>
            <button onClick={() => { actions.shareProgress(shareText); setConfirmShare(false); }} style={primaryBtnStyle}>Share</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   PAGE 4 — Weekly Planner
------------------------------------------------------------------------- */
function Planner({ state, actions }) {
  const [addingFor, setAddingFor] = useState(null); // iso date string
  const [draft, setDraft] = useState("");
  const [celebrating, setCelebrating] = useState(null); // item id currently bursting confetti
  const weekDates = currentWeekDates();
  const perDayLimit = state.pro ? PRO_PLANNER_PER_DAY : FREE_PLANNER_PER_DAY;

  const submit = () => {
    if (!draft.trim() || !addingFor) return;
    actions.addPlannerItem(addingFor, draft.trim());
    setDraft("");
    setAddingFor(null);
  };

  const toggleDone = (iso, it) => {
    const willBeDone = !it.done;
    actions.togglePlannerItemDone(iso, it.id);
    if (willBeDone && state.confettiEnabled) {
      setCelebrating(it.id);
      setTimeout(() => setCelebrating(c => c === it.id ? null : c), 700);
    }
  };

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar title="Weekly planner" />
      <div style={{ padding: "0 20px 6px", fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--bark-700)" }}>
        Plan up to {FREE_PLANNER_PER_DAY} things per day for free{!state.pro ? " — Pro raises that to " + PRO_PLANNER_PER_DAY : ""}. This is separate from your habit points.
      </div>

      <div style={{
        margin: "8px 20px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        padding: "10px 14px", borderRadius: 12, background: "var(--parchment-50)", boxShadow: "var(--shadow-card)",
      }}>
        <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--forest-900)" }}>
          🎉 Celebrate when you finish something
        </span>
        <button onClick={() => actions.setConfettiEnabled(!state.confettiEnabled)} style={{
          width: 40, height: 22, borderRadius: 999, border: "none", cursor: "pointer", position: "relative",
          background: state.confettiEnabled ? "var(--moss-600)" : "var(--parchment-100)", flexShrink: 0,
        }}>
          <span style={{
            position: "absolute", top: 2, left: state.confettiEnabled ? 20 : 2, width: 18, height: 18,
            borderRadius: "50%", background: "#fff", transition: "left .15s ease", boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
          }} />
        </button>
      </div>

      <div style={{ padding: "10px 20px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10, alignItems: "start" }}>
        {weekDates.map(d => {
          const iso = isoDate(d);
          const items = state.plannerItems[iso] || [];
          const isToday = iso === isoDate(new Date());
          const atLimit = items.length >= perDayLimit;
          return (
            <div key={iso} style={{
              background: "var(--parchment-50)", borderRadius: 16, padding: "12px 14px",
              boxShadow: "var(--shadow-card)", border: isToday ? "1.5px solid var(--gold-600)" : "1.5px solid transparent",
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13, color: "var(--forest-900)" }}>{WEEKDAY_SHORT[d.getDay()]}</span>
                <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--bark-700)" }}>{d.getDate()}/{d.getMonth() + 1}</span>
                {isToday && <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, fontWeight: 700, color: "var(--gold-600)" }}>· today</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {items.map(it => (
                  <div key={it.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    background: "var(--parchment-100)", borderRadius: 10, padding: "8px 10px", position: "relative",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                      <button onClick={() => toggleDone(iso, it)} style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: "1.5px solid var(--moss-400)",
                        background: it.done ? "var(--moss-600)" : "#fff", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
                      }}>
                        {it.done && <Check size={13} color="#fff" strokeWidth={3} />}
                        {celebrating === it.id && (
                          <>
                            {["#e9c46a", "#ec8a72", "#84a98c", "#f4a896", "#d4a84a", "#52796f"].map((c, ci) => (
                              <span key={ci} style={{
                                position: "absolute", left: "50%", top: "50%", width: 5, height: 5, background: c,
                                borderRadius: ci % 2 === 0 ? "50%" : "1px", pointerEvents: "none",
                                animation: `grove-confetti-${ci} .65s ease-out forwards`,
                              }} />
                            ))}
                          </>
                        )}
                      </button>
                      <span style={{
                        fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--forest-900)",
                        textDecoration: it.done ? "line-through" : "none", opacity: it.done ? 0.55 : 1,
                      }}>{it.text}</span>
                    </div>
                    <button onClick={() => actions.removePlannerItem(iso, it.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--bark-700)", display: "flex", flexShrink: 0 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => atLimit && !state.pro ? actions.openPaywall() : setAddingFor(iso)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "8px", borderRadius: 10, border: "1.5px dashed var(--moss-400)",
                    background: "transparent", color: "var(--moss-600)", cursor: "pointer",
                    fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
                  }}>
                  {atLimit && !state.pro ? <Lock size={12} /> : <Plus size={12} />}
                  {atLimit && !state.pro ? "Upgrade for more" : `Add (${items.length}/${perDayLimit})`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {addingFor && (
        <Modal onClose={() => setAddingFor(null)}>
          <h3 style={modalTitleStyle}>Add to your plan</h3>
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="e.g. Meal prep lunches"
            style={inputStyle} />
          <button onClick={submit} style={primaryBtnStyle}>Add to day</button>
        </Modal>
      )}
      <style>{`
        @keyframes grove-confetti-0 { 0% { transform: translate(0,0) scale(0.6); opacity: 1; } 100% { transform: translate(18px,-16px) rotate(200deg) scale(1); opacity: 0; } }
        @keyframes grove-confetti-1 { 0% { transform: translate(0,0) scale(0.6); opacity: 1; } 100% { transform: translate(-16px,-18px) rotate(-160deg) scale(1); opacity: 0; } }
        @keyframes grove-confetti-2 { 0% { transform: translate(0,0) scale(0.6); opacity: 1; } 100% { transform: translate(-20px,4px) rotate(140deg) scale(1); opacity: 0; } }
        @keyframes grove-confetti-3 { 0% { transform: translate(0,0) scale(0.6); opacity: 1; } 100% { transform: translate(-10px,18px) rotate(-120deg) scale(1); opacity: 0; } }
        @keyframes grove-confetti-4 { 0% { transform: translate(0,0) scale(0.6); opacity: 1; } 100% { transform: translate(12px,20px) rotate(160deg) scale(1); opacity: 0; } }
        @keyframes grove-confetti-5 { 0% { transform: translate(0,0) scale(0.6); opacity: 1; } 100% { transform: translate(20px,-2px) rotate(-200deg) scale(1); opacity: 0; } }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Paywall modal
------------------------------------------------------------------------- */
function PlansPage({ state, actions }) {
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { actions.ensureLifetimeOfferStarted(); }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const lifetimeRemaining = state.lifetimeOfferExpiresAt ? Math.max(0, state.lifetimeOfferExpiresAt - now) : LIFETIME_OFFER_MS;
  const lifetimeExpired = state.lifetimeOfferExpiresAt !== null && lifetimeRemaining <= 0;
  const lifetimeSeconds = Math.ceil(lifetimeRemaining / 1000);

  const sendAiMessage = async () => {
    const text = aiInput.trim();
    if (!text || aiLoading || state.sparks < AI_ADVISER_COST) return;
    const newMessages = [...aiMessages, { role: "user", text }];
    setAiMessages(newMessages);
    setAiInput("");
    setAiLoading(true);
    setAiError(null);
    actions.spendSparks(AI_ADVISER_COST);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 400,
          system: "You are the Grove AI Adviser — a warm, encouraging habit coach inside a plant-growing self-improvement app called Grove. Give brief, practical, kind advice about habits, motivation, and daily routines. Keep replies to 2-4 short sentences, conversational and supportive, never clinical.",
          messages: newMessages.map(m => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await response.json();
      const replyText = (data.content || []).map(c => c.text || "").join("\n").trim() || "Sorry, I couldn't think of anything just then — try asking again.";
      setAiMessages(m => [...m, { role: "assistant", text: replyText }]);
    } catch (err) {
      actions.refundSparks(AI_ADVISER_COST);
      setAiError(`Couldn't reach the adviser — your ${AI_ADVISER_COST} Sparks were refunded. Please try again.`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: 100 }}>
      <TopBar title="Plans" right={<SparksPill sparks={state.sparks} />} />

      <div style={{ padding: "0 20px" }}>
        <AuthPanel user={state.authUser} signInWithEmail={actions.signInWithEmail} signOut={actions.signOut} />
        {state.authUser && state.hasStripeCustomer && (
          <button onClick={actions.manageSubscription} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 14px", borderRadius: 12, border: "1.5px solid var(--parchment-100)", cursor: "pointer",
            background: "transparent", color: "var(--bark-700)",
            fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12, marginBottom: 10,
          }}>Manage subscription</button>
        )}
      </div>

      <SectionLabel label="Grove Pro" icon={<Crown size={14} />} sub={state.pro ? `You're on the ${state.proPlan || "monthly"} plan` : "Unlimited habits, journal, AI coach & more"} />
      <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10, alignItems: "start" }}>
        {PRO_PLANS.map(p => {
          const isLifetime = p.id === "lifetime";
          const disabled = (isLifetime && lifetimeExpired) || !state.authUser;
          const active = state.pro && state.proPlan === p.id;
          return (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 16,
              background: active ? "rgba(233,196,106,0.18)" : "var(--parchment-50)",
              border: active ? "1.5px solid var(--gold-600)" : "1.5px solid var(--parchment-100)",
              boxShadow: "var(--shadow-card)", opacity: disabled ? 0.5 : 1,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 14, color: "var(--forest-900)" }}>{p.label}</span>
                  {p.badge && !(isLifetime && lifetimeExpired) && (
                    <span style={{
                      fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 9, color: "var(--gold-600)",
                      background: "rgba(233,196,106,0.2)", padding: "2px 6px", borderRadius: 999, textTransform: "uppercase",
                    }}>{p.badge}</span>
                  )}
                </div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--bark-700)" }}>{p.sub}</div>
                {isLifetime && !lifetimeExpired && (
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 11, color: "var(--blush-500)", marginTop: 2 }}>
                    ⏳ Ends in {lifetimeSeconds}s
                  </div>
                )}
                {isLifetime && lifetimeExpired && (
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 11, color: "var(--bark-700)", marginTop: 2 }}>Offer expired</div>
                )}
              </div>
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17, color: "var(--forest-900)", flexShrink: 0 }}>{p.price}</div>
              <button onClick={() => actions.startCheckout(p.id)} disabled={disabled} style={{
                padding: "8px 12px", borderRadius: 10, border: "none", cursor: disabled ? "default" : "pointer",
                background: active ? "var(--moss-600)" : disabled ? "var(--parchment-100)" : "var(--forest-900)",
                color: active ? "#fff" : disabled ? "var(--bark-700)" : "var(--gold-500)",
                fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12, flexShrink: 0,
                opacity: disabled && !active ? 0.7 : 1,
              }}>{active ? "Active" : isLifetime && lifetimeExpired ? "Expired" : "Choose"}</button>
            </div>
          );
        })}
        <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--bark-700)", textAlign: "center" }}>
          {state.authUser ? "Secure checkout via Stripe." : "Sign in above to subscribe."}
        </p>
      </div>

      <SectionLabel label="Buy Sparks" icon={<Sparkles size={14} />} sub="Top up your Sparks balance for shiny skins and the AI Adviser" />
      <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        {SHINY_BUNDLES.map(b => (
          <button key={b.id} onClick={() => state.authUser ? actions.startSparkCheckout(b.id) : actions.buySparkBundle(b.amount)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "14px 8px", borderRadius: 14,
            border: "1px solid var(--parchment-100)", background: "var(--parchment-50)", cursor: "pointer", boxShadow: "var(--shadow-card)",
          }}>
            <span style={{ fontSize: 20 }}>✨</span>
            <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15, color: "var(--forest-900)" }}>{b.amount}</span>
            <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12, color: "var(--moss-600)" }}>{b.price}</span>
          </button>
        ))}
      </div>
      <p style={{ padding: "6px 20px 0", fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--bark-700)", textAlign: "center" }}>
        {state.authUser ? "Secure checkout via Stripe." : "Sign in above for a real purchase — tapping a bundle while signed out just credits Sparks for local testing."}
      </p>

      <SectionLabel label="AI Adviser" icon={<Sparkles size={14} />} sub={`${AI_ADVISER_COST} Sparks per message`} />
      <div style={{ padding: "0 20px" }}>
        <div style={{ background: "var(--parchment-50)", borderRadius: 16, boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
          <div style={{ maxHeight: 260, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {aiMessages.length === 0 && (
              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--bark-700)", textAlign: "center", padding: "10px 0" }}>
                🐲 Ask me anything about building better habits — {AI_ADVISER_COST} Sparks per message.
              </div>
            )}
            {aiMessages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "82%",
                background: m.role === "user" ? "var(--forest-900)" : "var(--parchment-100)",
                color: m.role === "user" ? "var(--gold-500)" : "var(--forest-900)",
                padding: "8px 12px", borderRadius: 12, fontFamily: "'Manrope', sans-serif", fontSize: 13,
              }}>{m.text}</div>
            ))}
            {aiLoading && <div style={{ alignSelf: "flex-start", fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--bark-700)" }}>Thinking…</div>}
            {aiError && <div style={{ alignSelf: "flex-start", fontFamily: "'Manrope', sans-serif", fontSize: 12, color: "var(--blush-500)" }}>{aiError}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderTop: "1px solid var(--parchment-100)" }}>
            <input value={aiInput} onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendAiMessage()}
              placeholder={state.sparks < AI_ADVISER_COST ? "Buy more Sparks to chat..." : "Ask the adviser..."}
              style={{ flex: 1, border: "1.5px solid var(--parchment-100)", borderRadius: 10, padding: "9px 12px", fontFamily: "'Manrope', sans-serif", fontSize: 13, outline: "none" }}
            />
            <button onClick={sendAiMessage} disabled={aiLoading || !aiInput.trim() || state.sparks < AI_ADVISER_COST} style={{
              padding: "9px 14px", borderRadius: 10, border: "none",
              cursor: aiLoading || state.sparks < AI_ADVISER_COST ? "default" : "pointer",
              background: "var(--forest-900)", color: "var(--gold-500)", fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 12,
              opacity: state.sparks < AI_ADVISER_COST ? 0.5 : 1,
            }}>✨ {AI_ADVISER_COST}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Paywall({ onClose, onSubscribe }) {
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const plan = PRO_PLANS.find(p => p.id === selectedPlan);
  return (
    <Modal onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Crown size={20} color="var(--gold-600)" />
        <h3 style={{ ...modalTitleStyle, margin: 0 }}>Grove Pro</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "12px 0 6px" }}>
        {PRO_PLANS.map(p => {
          const active = selectedPlan === p.id;
          return (
            <button key={p.id} onClick={() => setSelectedPlan(p.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 14,
              border: active ? "1.5px solid var(--gold-600)" : "1.5px solid var(--parchment-100)",
              background: active ? "rgba(233,196,106,0.15)" : "#fff", cursor: "pointer", textAlign: "left",
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                border: `2px solid ${active ? "var(--gold-600)" : "var(--parchment-100)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {active && <div style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--gold-600)" }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 13, color: "var(--forest-900)" }}>{p.label}</span>
                  {p.badge && (
                    <span style={{
                      fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 9, color: "var(--gold-600)",
                      background: "rgba(233,196,106,0.2)", padding: "2px 6px", borderRadius: 999, textTransform: "uppercase",
                    }}>{p.badge}</span>
                  )}
                </div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--bark-700)" }}>{p.sub}</div>
              </div>
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18, color: "var(--forest-900)" }}>{p.price}</div>
            </button>
          );
        })}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "14px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          "Unlimited habits to grow and to break",
          "More planner slots per day",
          "Personal journal",
          "AI coach for grove-side advice",
          "Content blocker",
        ].map(f => (
          <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Manrope', sans-serif", fontSize: 13, color: "var(--forest-900)" }}>
            <Check size={15} color="var(--moss-600)" strokeWidth={3} /> {f}
          </li>
        ))}
      </ul>
      <button onClick={() => onSubscribe(selectedPlan)} style={primaryBtnStyle}>
        {plan.id === "lifetime" ? `Get lifetime access — ${plan.price}` : `Start Pro — ${plan.price}`}
      </button>
      <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, color: "var(--bark-700)", textAlign: "center", marginTop: 8 }}>
        Demo only — no real payment is processed.
      </p>
    </Modal>
  );
}

/* -------------------------------------------------------------------------
   Shared modal + input styles
------------------------------------------------------------------------- */
function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,35,24,0.45)", zIndex: 50,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--parchment-50)", borderRadius: "24px 24px 0 0", padding: "22px 20px 28px",
        width: "100%", maxWidth: 560, maxHeight: "80vh", overflowY: "auto",
        animation: "modal-up .25s ease-out",
      }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ border: "none", background: "var(--parchment-100)", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>
        {children}
        <style>{`@keyframes modal-up { 0% { transform: translateY(30px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }`}</style>
      </div>
    </div>
  );
}

const modalTitleStyle = { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 20, color: "var(--forest-900)", margin: "0 0 14px" };
const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--parchment-100)", fontFamily: "'Manrope', sans-serif", fontSize: 14, marginBottom: 12, outline: "none", boxSizing: "border-box" };
const primaryBtnStyle = { width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: "pointer", background: "var(--forest-900)", color: "var(--gold-500)", fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 14 };

/* -------------------------------------------------------------------------
   Bottom tab bar
------------------------------------------------------------------------- */
function TabBar({ page, setPage }) {
  const tabs = [
    { id: "tracker", label: "Habits", icon: ListChecks },
    { id: "grove", label: "Grove", icon: Trees },
    { id: "stats", label: "Progress", icon: BarChart2 },
    { id: "planner", label: "Planner", icon: CalendarDays },
    { id: "plans", label: "Plans", icon: Crown },
  ];
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 1000, margin: "0 auto",
      background: "var(--parchment-50)", borderTop: "1px solid var(--parchment-100)",
      display: "flex", padding: "8px 6px calc(8px + env(safe-area-inset-bottom))",
      boxShadow: "0 -4px 16px rgba(15,35,24,0.06)",
    }}>
      {tabs.map(t => {
        const Icon = t.icon;
        const active = page === t.id;
        return (
          <button key={t.id} onClick={() => setPage(t.id)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "8px 0", border: "none", background: "none", cursor: "pointer",
            color: active ? "var(--forest-900)" : "var(--moss-400)",
          }}>
            <Icon size={17} strokeWidth={active ? 2.4 : 2} fill={active && t.id === "grove" ? "var(--moss-400)" : "none"} />
            <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 9 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Root app
------------------------------------------------------------------------- */
export default function GroveApp() {
  useFonts();
  const auth = useAuth();
  const [showQuoteOfDay, setShowQuoteOfDay] = useState(true);
  const [page, setPage] = useState("tracker");
  const [detailHabitId, setDetailHabitId] = useState(null);
  const [pro, setPro] = useState(false);
  const [creatorMode, setCreatorMode] = useState(false);
  const [creatorAccessUnlocked, setCreatorAccessUnlocked] = useState(false);
  const [points, setPoints] = useState(70);
  const [flowers, setFlowers] = useState(0);
  const [sparks, setSparks] = useState(0);
  const [shinyUnlocked, setShinyUnlocked] = useState([]);
  const [shinyHidden, setShinyHidden] = useState([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [bonusDone, setBonusDone] = useState(false);
  const [lastSparkDate, setLastSparkDate] = useState(null);
  const [lifetimeOfferExpiresAt, setLifetimeOfferExpiresAt] = useState(null);
  const [proPlan, setProPlan] = useState(null); // 'monthly' | 'yearly' | 'lifetime' | null
  const [bonusCategory, setBonusCategoryState] = useState("social");
  const [confettiEnabled, setConfettiEnabled] = useState(true);
  const [feedbackType, setFeedbackType] = useState("idea");
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState([]);
  const [positive, setPositive] = useState(START_POSITIVE);
  const [negative, setNegative] = useState(START_NEGATIVE);
  const [friends, setFriends] = useState(FRIENDS);
  const [unlocked, setUnlocked] = useState(["tree"]);
  const [hiddenFeatureIds, setHiddenFeatureIds] = useState([]);
  const [unlockedEnvs, setUnlockedEnvs] = useState(["meadow"]);
  const [environment, setEnvironment] = useState("meadow");
  const [sharedUpdates, setSharedUpdates] = useState([]);
  const [plannerItems, setPlannerItems] = useState({});
  const [placedItems, setPlacedItems] = useState([
    { id: "seed-tree-1", type: "decor", emoji: "🌳", x: 70, y: 60, world: "land" },
    { id: "seed-tree-2", type: "decor", emoji: "🌳", x: 85, y: 68, world: "land" },
  ]);
  const [saveLoaded, setSaveLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error' | null

  // If we've just come back from a successful Stripe checkout, refresh the
  // user's Pro status from the database and clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      auth.refreshProfile();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [auth.user]);

  // Capture a friend's invite link (?ref=theirUserId) on first visit, store it for
  // later — the person opening the link might browse a while before signing in.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      try { window.localStorage.setItem("grove_referral_code", ref); } catch (err) {}
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Once signed in, if there's a stored referral code and this account hasn't
  // been attributed to anyone yet, credit the referrer for real via the server.
  useEffect(() => {
    if (!auth.user || !auth.profile) return;
    if (auth.profile.referred_by) return; // already attributed — never credit twice
    let storedRef = null;
    try { storedRef = window.localStorage.getItem("grove_referral_code"); } catch (err) {}
    if (!storedRef || storedRef === auth.user.id) return;

    (async () => {
      try {
        const res = await fetch("/api/credit-referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newUserId: auth.user.id, referrerId: storedRef }),
        });
        const data = await res.json();
        if (data.success) {
          try { window.localStorage.removeItem("grove_referral_code"); } catch (err) {}
        }
      } catch (err) {
        // network hiccup — leave the stored code in place, we'll retry next time this effect runs
      }
    })();
  }, [auth.user, auth.profile]);

  // Load any previously saved progress once, on first mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await groveStorage.get("grove-save");
        if (cancelled || !result) return;
        const data = JSON.parse(result.value);

        // sanitize against items that may have been removed/renamed since this save was made
        const validShopIds = new Set(SHOP_ITEMS.map(i => i.id));
        const validEnvIds = new Set(ENVIRONMENTS.map(e => e.id));
        if (data.unlocked) data.unlocked = data.unlocked.filter(id => validShopIds.has(id) || id === "tree");
        if (data.hiddenFeatureIds) data.hiddenFeatureIds = data.hiddenFeatureIds.filter(id => validShopIds.has(id));
        if (data.placedItems) data.placedItems = data.placedItems.filter(it => !it.shopId || validShopIds.has(it.shopId));
        if (data.unlockedEnvs) data.unlockedEnvs = data.unlockedEnvs.filter(id => validEnvIds.has(id));
        if (data.environment && !validEnvIds.has(data.environment)) data.environment = "meadow";
        if (data.shinyUnlocked) data.shinyUnlocked = data.shinyUnlocked.filter(id => validShopIds.has(id));
        if (data.shinyHidden) data.shinyHidden = data.shinyHidden.filter(id => validShopIds.has(id));

        if (data.pro !== undefined) setPro(data.pro);
        if (data.creatorMode !== undefined) setCreatorMode(data.creatorMode);
        if (data.creatorAccessUnlocked !== undefined) setCreatorAccessUnlocked(data.creatorAccessUnlocked);
        if (data.points !== undefined) setPoints(data.points);
        if (data.flowers !== undefined) setFlowers(data.flowers);
        if (data.sparks !== undefined) setSparks(data.sparks);
        if (data.shinyUnlocked !== undefined) setShinyUnlocked(data.shinyUnlocked);
        if (data.shinyHidden !== undefined) setShinyHidden(data.shinyHidden);
        if (data.bonusDone !== undefined) setBonusDone(data.bonusDone);
        if (data.lastSparkDate !== undefined) setLastSparkDate(data.lastSparkDate);
        if (data.lifetimeOfferExpiresAt !== undefined) setLifetimeOfferExpiresAt(data.lifetimeOfferExpiresAt);
        if (data.proPlan !== undefined) setProPlan(data.proPlan);
        if (data.bonusCategory !== undefined) setBonusCategoryState(data.bonusCategory);
        if (data.confettiEnabled !== undefined) setConfettiEnabled(data.confettiEnabled);
        if (data.feedbackSubmitted !== undefined) setFeedbackSubmitted(data.feedbackSubmitted);
        if (data.positive !== undefined) setPositive(data.positive);
        if (data.negative !== undefined) setNegative(data.negative);
        if (data.friends !== undefined) setFriends(data.friends);
        if (data.unlocked !== undefined) setUnlocked(data.unlocked);
        if (data.hiddenFeatureIds !== undefined) setHiddenFeatureIds(data.hiddenFeatureIds);
        if (data.unlockedEnvs !== undefined) setUnlockedEnvs(data.unlockedEnvs);
        if (data.environment !== undefined) setEnvironment(data.environment);
        if (data.sharedUpdates !== undefined) setSharedUpdates(data.sharedUpdates);
        if (data.plannerItems !== undefined) setPlannerItems(data.plannerItems);
        if (data.placedItems !== undefined) setPlacedItems(data.placedItems);
      } catch (err) {
        // no save yet, or storage unavailable — just continue with defaults
      } finally {
        if (!cancelled) setSaveLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Save progress whenever anything meaningful changes, once the initial load has finished.
  useEffect(() => {
    if (!saveLoaded) return;
    const payload = {
      pro, creatorMode, creatorAccessUnlocked, points, flowers, sparks, shinyUnlocked, shinyHidden, bonusDone, bonusCategory, lastSparkDate, lifetimeOfferExpiresAt, proPlan, confettiEnabled,
      feedbackSubmitted, positive, negative, friends, unlocked, hiddenFeatureIds, unlockedEnvs,
      environment, sharedUpdates, plannerItems, placedItems,
    };
    setSaveStatus("saving");
    const t = setTimeout(async () => {
      try {
        await groveStorage.set("grove-save", JSON.stringify(payload));
        setSaveStatus("saved");
      } catch (err) {
        setSaveStatus("error");
      }
    }, 500); // debounce so rapid changes (like dragging) don't spam saves
    return () => clearTimeout(t);
  }, [
    saveLoaded, pro, creatorMode, creatorAccessUnlocked, points, flowers, sparks, shinyUnlocked, shinyHidden, bonusDone, bonusCategory, lastSparkDate, lifetimeOfferExpiresAt, proPlan, confettiEnabled,
    feedbackSubmitted, positive, negative, friends, unlocked, hiddenFeatureIds, unlockedEnvs,
    environment, sharedUpdates, plannerItems, placedItems,
  ]);

  const negativeDerived = negative.map(h => ({ ...h, done: weekSum(h.history) }));
  const lateInWeek = isoWeekdayToday() >= 4; // pests only start showing from Thursday onward
  const rawFogLevel = Math.min(3, negativeDerived.filter(h => h.done < h.target).length);
  const fogLevel = lateInWeek ? rawFogLevel : 0;

  const toggleCreatorMode = () => {
    const next = !creatorMode;
    setCreatorMode(next);
    if (next) { setPro(true); setPoints(99999); setSparks(9999); }
    else { setPro(false); setPoints(70); setSparks(0); }
  };

  // Secret unlock: tap the invisible corner zone 7 times within 3 seconds to reveal Creator Mode.
  const secretTapsRef = useRef([]);
  const handleSecretTap = () => {
    const now = Date.now();
    secretTapsRef.current = [...secretTapsRef.current, now].filter(t => now - t < 3000);
    if (secretTapsRef.current.length >= 7) {
      secretTapsRef.current = [];
      setCreatorAccessUnlocked(true);
    }
  };

  const resetGrove = () => {
    setPositive(START_POSITIVE);
    setNegative(START_NEGATIVE);
    setFriends(FRIENDS);
    setUnlocked(["tree"]);
    setHiddenFeatureIds([]);
    setUnlockedEnvs(["meadow"]);
    setEnvironment("meadow");
    setPlacedItems([
      { id: "seed-tree-1", type: "decor", emoji: "🌳", x: 70, y: 60, world: "land" },
      { id: "seed-tree-2", type: "decor", emoji: "🌳", x: 85, y: 68, world: "land" },
    ]);
    setSharedUpdates([]);
    setPlannerItems({});
    setFlowers(0);
    setSparks(0);
    setShinyUnlocked([]);
    setShinyHidden([]);
    setLastSparkDate(null);
    setDetailHabitId(null);
    setPage("tracker");
    if (creatorMode) { setPro(true); setPoints(99999); } else { setPro(false); setPoints(70); }
  };

  const actions = {
    openPaywall: () => setShowPaywall(true),
    openHabitDetail: (id) => setDetailHabitId(id),
    closeHabitDetail: () => setDetailHabitId(null),
    toggleDay: (id, iso) => {
      const todayIso = isoDate(new Date());
      if (iso !== todayIso) return; // only today can be adjusted
      const total = positive.length;
      const countDone = (arr) => arr.filter(h => h.history[h.history.length - 1] === 1).length;
      const dailyBonus = (done) => total === 0 ? 0 : Math.max(0, 30 - 6 * (total - done));
      const before = dailyBonus(countDone(positive));
      const newList = positive.map(h => {
        if (h.id !== id) return h;
        const history = h.history.slice();
        history[history.length - 1] = history[history.length - 1] ? 0 : 1;
        return { ...h, history };
      });
      const after = dailyBonus(countDone(newList));
      setPositive(newList);
      setPoints(p => Math.max(0, p + (after - before)));
    },
    toggleToday: (id) => actions.toggleDay(id, isoDate(new Date())),
    toggleNegativeDay: (id, iso) => {
      const todayIso = isoDate(new Date());
      if (iso > todayIso) return; // no editing future days
      const dates = lastNDates(HISTORY_LEN);
      const dayIdx = dates.findIndex(d => isoDate(d) === iso);
      if (dayIdx < 0) return;
      const countClean = (arr) => arr.filter(h => h.history[dayIdx] === 1).length;
      const total = negative.length;
      const dailyBonus = (clean) => Math.min(24, 6 * clean) - 6 * (total - clean);
      const before = dailyBonus(countClean(negative));
      const newList = negative.map(h => {
        if (h.id !== id) return h;
        const history = h.history.slice();
        history[dayIdx] = history[dayIdx] ? 0 : 1;
        return { ...h, history };
      });
      const after = dailyBonus(countClean(newList));
      setNegative(newList);
      setPoints(p => Math.max(0, p + (after - before)));
    },
    addHabit: (kind, name) => {
      if (kind === "positive") {
        setPositive(list => [...list, { id: "p" + Date.now(), name, history: new Array(HISTORY_LEN).fill(0) }]);
      } else {
        setNegative(list => [...list, { id: "n" + Date.now(), name, target: 4, history: new Array(HISTORY_LEN).fill(0) }]);
      }
    },
    deleteHabit: (kind, id) => {
      if (kind === "positive") setPositive(list => list.filter(h => h.id !== id));
      else setNegative(list => list.filter(h => h.id !== id));
    },
    editHabit: (kind, id, name) => {
      if (!name.trim()) return;
      if (kind === "positive") setPositive(list => list.map(h => h.id === id ? { ...h, name: name.trim() } : h));
      else setNegative(list => list.map(h => h.id === id ? { ...h, name: name.trim() } : h));
    },
    setNegativeTarget: (id, target) => {
      setNegative(list => list.map(h => h.id === id ? { ...h, target } : h));
    },
    toggleShopItem: (item) => {
      const owned = unlocked.includes(item.id);
      const draggableType = item.type === "decor" || (item.type === "animal" && item.id !== "fish") || item.id === "pond" || item.type === "lilypad" || item.type === "frog";
      const hostLive = !item.livesOn || placedItems.some(p => p.shopId === item.livesOn);

      const spawnPos = (list) => {
        if (item.id === "pond") return { x: 50, y: 90 };
        if (item.livesOn) {
          const host = list.find(p => p.shopId === item.livesOn);
          if (host) return { x: host.x, y: item.id === "sloth" ? Math.max(8, host.y - 14) : host.y };
        }
        return { x: 30 + Math.random() * 40, y: 55 + Math.random() * 20 };
      };
      const makeInstance = (list) => {
        const pos = spawnPos(list);
        return {
          id: item.id + "-" + Date.now(), shopId: item.id,
          type: item.id === "pond" ? "pond" : item.type, emoji: item.emoji,
          colors: item.colors || null, world: item.world || "land",
          x: pos.x, y: pos.y,
          roamDistance: 18 + Math.random() * 22,
          roamDuration: 4.5 + Math.random() * 3,
        };
      };
      // remove an item and anything that lives on it, recursively (pond -> lily pad -> frog, tree -> sloth, etc.)
      const dependentIdsOf = (rootId) => {
        const removed = new Set([rootId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const si of SHOP_ITEMS) {
            if (si.livesOn && removed.has(si.livesOn) && !removed.has(si.id)) {
              removed.add(si.id);
              changed = true;
            }
          }
        }
        return removed;
      };

      if (!owned) {
        if (item.requires && !unlocked.includes(item.requires)) return;
        if (!hostLive) return; // needs its live host (water, lily pad, tree...) in the grove right now
        if (points < item.cost) return;
        setPoints(p => p - item.cost);
        setUnlocked(u => [...u, item.id]);
        if (draggableType) {
          setPlacedItems(list => [
            ...(item.type === "frog" ? list.filter(p => p.type !== "frog") : list),
            makeInstance(list),
          ]);
        }
        return;
      }

      // already owned — toggle placement (draggable items) or visibility (waterfall/fish)
      if (draggableType) {
        const exists = placedItems.some(p => p.shopId === item.id);
        if (exists) {
          const removedIds = dependentIdsOf(item.id);
          setPlacedItems(list => list.filter(p => !removedIds.has(p.shopId)));
        } else {
          if (!hostLive) return; // no live host to attach to right now
          setPlacedItems(list => [
            ...(item.type === "frog" ? list.filter(p => p.type !== "frog") : list),
            makeInstance(list),
          ]);
        }
      } else {
        setHiddenFeatureIds(ids => ids.includes(item.id) ? ids.filter(x => x !== item.id) : [...ids, item.id]);
      }
    },
    buyEnvironment: (env) => {
      if (unlockedEnvs.includes(env.id) || points < env.cost) return;
      setPoints(p => p - env.cost);
      setUnlockedEnvs(u => [...u, env.id]);
      setEnvironment(env.id);
    },
    setEnvironment: (id) => setEnvironment(id),
    enterNewWorld: () => {
      const currentWorld = WORLD_BY_ENV[environment] || "land";
      const nextWorld = WORLD_ORDER[(WORLD_ORDER.indexOf(currentWorld) + 1) % WORLD_ORDER.length];
      const target = ENVIRONMENTS.find(e => e.world === nextWorld);
      if (!target) return;
      if (unlockedEnvs.includes(target.id)) {
        setEnvironment(target.id);
      } else if (points >= target.cost) {
        setPoints(p => p - target.cost);
        setUnlockedEnvs(u => [...u, target.id]);
        setEnvironment(target.id);
      }
    },
    movePlacedItem: (id, x, y) => {
      setPlacedItems(list => list.map(it => it.id === id ? { ...it, x, y } : it));
    },
    congratulate: (id) => {
      setFriends(list => list.map(f => f.id === id ? { ...f, kudos: f.kudos + 1 } : f));
    },
    inviteFriend: () => {
      if (auth.user) return; // signed in: reward only lands once someone actually signs up via your link
      // signed out — local demo fallback so the feature is still testable without an account
      setFlowers(f => Math.min(1, f + 1));
    },
    subscribe: (planId) => { setPro(true); setProPlan(planId || "monthly"); setShowPaywall(false); },
    shareProgress: (text) => {
      setSharedUpdates(list => [...list, { id: Date.now(), text }]);
    },
    addPlannerItem: (iso, text) => {
      setPlannerItems(map => {
        const existing = map[iso] || [];
        return { ...map, [iso]: [...existing, { id: Date.now(), text, done: false }] };
      });
    },
    removePlannerItem: (iso, id) => {
      setPlannerItems(map => ({ ...map, [iso]: (map[iso] || []).filter(it => it.id !== id) }));
    },
    togglePlannerItemDone: (iso, id) => {
      setPlannerItems(map => ({
        ...map,
        [iso]: (map[iso] || []).map(it => it.id === id ? { ...it, done: !it.done } : it),
      }));
    },
    setConfettiEnabled: (val) => setConfettiEnabled(val),
    openResetConfirm: () => setShowResetConfirm(true),
    closeResetConfirm: () => setShowResetConfirm(false),
    confirmReset: () => { resetGrove(); setShowResetConfirm(false); },
    openFeedback: () => setShowFeedback(true),
    closeFeedback: () => { setShowFeedback(false); setFeedbackDraft(""); },
    setFeedbackType: (t) => setFeedbackType(t),
    setFeedbackDraft: (t) => setFeedbackDraft(t),
    submitFeedback: () => {
      if (!feedbackDraft.trim()) return;
      setFeedbackSubmitted(list => [...list, { id: Date.now(), type: feedbackType, text: feedbackDraft.trim() }]);
      setFeedbackDraft("");
    },
    toggleBonusObjective: () => {
      const today = isoDate(new Date());
      const next = !bonusDone;
      setBonusDone(next);
      setPoints(p => Math.max(0, p + (next ? 15 : -15)));
      if (next) {
        if (lastSparkDate !== today) {
          setSparks(s => s + 1);
          setLastSparkDate(today);
        }
      } else {
        if (lastSparkDate === today) {
          setSparks(s => Math.max(0, s - 1));
          setLastSparkDate(null);
        }
      }
    },
    setBonusCategory: (cat) => {
      setBonusCategoryState(cat);
      if (bonusDone) setPoints(p => Math.max(0, p - 15));
      setBonusDone(false);
    },
    plantFlower: () => {
      const currentFlowers = auth.user && auth.profile ? (auth.profile.flowers || 0) : flowers;
      if (currentFlowers <= 0) return;
      if (placedItems.some(it => it.type === "frienddragon")) return; // max 1 dragon, ever
      if (auth.user) { auth.adjustFlowers(-1); } else { setFlowers(f => Math.max(0, f - 1)); }
      setPlacedItems(list => [...list, {
        id: "dragon-" + Date.now(), type: "frienddragon", emoji: "🐲",
        world: WORLD_BY_ENV[environment] || "land",
        x: 30 + Math.random() * 40, y: 55 + Math.random() * 20,
      }]);
    },
    removeDragon: () => {
      if (!placedItems.some(it => it.type === "frienddragon")) return;
      setPlacedItems(list => list.filter(it => it.type !== "frienddragon"));
      if (auth.user) { auth.adjustFlowers(1); } else { setFlowers(f => f + 1); }
    },
    buyShiny: (shopId, cost) => {
      const currentSparks = auth.user && auth.profile ? (auth.profile.sparks || 0) : sparks;
      if (shinyUnlocked.includes(shopId) || currentSparks < cost) return;
      if (auth.user) { auth.adjustSparks(-cost); } else { setSparks(s => Math.max(0, s - cost)); }
      setShinyUnlocked(list => [...list, shopId]);
    },
    toggleShinyVisible: (shopId) => {
      setShinyHidden(list => list.includes(shopId) ? list.filter(id => id !== shopId) : [...list, shopId]);
    },
    ensureLifetimeOfferStarted: () => {
      setLifetimeOfferExpiresAt(prev => prev !== null ? prev : Date.now() + LIFETIME_OFFER_MS);
    },
    subscribeToPlan: (planId) => {
      setPro(true);
      setProPlan(planId);
    },
    startCheckout: async (planId) => {
      if (!auth.user) return;
      try {
        const res = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId, userId: auth.user.id, email: auth.user.email }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert(data.error || "Something went wrong starting checkout — please try again.");
        }
      } catch (err) {
        alert("Couldn't reach the server. Please check your connection and try again.");
      }
    },
    manageSubscription: async () => {
      if (!auth.user || !auth.profile?.stripe_customer_id) {
        alert("No subscription found for this account yet.");
        return;
      }
      try {
        const res = await fetch("/api/create-portal-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId: auth.profile.stripe_customer_id }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert(data.error || "Couldn't open subscription management — please try again.");
        }
      } catch (err) {
        alert("Couldn't reach the server. Please check your connection and try again.");
      }
    },
    cancelPro: () => {
      setPro(false);
      setProPlan(null);
    },
    buySparkBundle: (amount) => {
      // local demo top-up — used only when signed out; signed-in purchases go through startSparkCheckout instead
      setSparks(s => s + amount);
    },
    startSparkCheckout: async (bundleId) => {
      if (!auth.user) return;
      try {
        const res = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bundleId, userId: auth.user.id, email: auth.user.email }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert(data.error || "Something went wrong starting checkout — please try again.");
        }
      } catch (err) {
        alert("Couldn't reach the server. Please check your connection and try again.");
      }
    },
    spendSparks: (amount) => {
      if (auth.user) { auth.adjustSparks(-amount); return; }
      setSparks(s => Math.max(0, s - amount));
    },
    refundSparks: (amount) => {
      if (auth.user) { auth.adjustSparks(amount); return; }
      setSparks(s => s + amount);
    },
    signInWithEmail: (email) => auth.signInWithEmail(email),
    signOut: () => auth.signOut(),
  };

  const positiveDerived = positive.map(h => ({
    ...h,
    doneToday: h.history[h.history.length - 1] === 1,
    streak: currentStreak(h.history),
  }));

  // Once signed in, real Pro status comes from the database (set by the Stripe webhook)
  // rather than the local demo toggle. Creator Mode always overrides, for testing.
  const effectivePro = creatorMode ? true : (auth.user && auth.profile ? auth.profile.pro : pro);
  const effectiveProPlan = auth.user && auth.profile ? auth.profile.pro_plan : proPlan;
  const effectiveSparks = creatorMode ? sparks : (auth.user && auth.profile ? (auth.profile.sparks || 0) : sparks);
  const effectiveFlowers = auth.user && auth.profile ? (auth.profile.flowers || 0) : flowers;

  const state = {
    page, pro: effectivePro, points, flowers: effectiveFlowers, sparks: effectiveSparks, shinyUnlocked, shinyHidden, positive: positiveDerived, negative: negativeDerived, friends,
    unlocked, hiddenFeatureIds, unlockedEnvs, environment, placedItems, fogLevel,
    sharedUpdates, plannerItems,
    showResetConfirm, showFeedback, feedbackType, feedbackDraft, feedbackSubmitted, bonusDone, bonusCategory, confettiEnabled,
    lifetimeOfferExpiresAt, proPlan: effectiveProPlan,
    authUser: auth.user, authLoading: auth.loading, hasStripeCustomer: !!auth.profile?.stripe_customer_id,
  };

  const detailHabit = positiveDerived.find(h => h.id === detailHabitId);

  return (
    <>
      <style>{`html { scrollbar-gutter: stable; overflow-y: scroll; }`}</style>
      <div style={{
        "--forest-950":"#0f2318", "--forest-900":"#153826", "--forest-800":"#1b4332",
        "--moss-600":"#52796f", "--moss-400":"#84a98c", "--gold-500":"#e9c46a",
        "--gold-600":"#d4a84a", "--blush-400":"#f4a896", "--blush-500":"#ec8a72",
        "--parchment-50":"#faf6ee", "--parchment-100":"#f2ecdd", "--bark-700":"#6b4423",
        "--bark-900":"#3f2a17", "--fog-white":"rgba(250,246,238,0.7)",
        "--shadow-soft":"0 8px 24px rgba(15,35,24,0.18)", "--shadow-card":"0 2px 10px rgba(15,35,24,0.08)",
        maxWidth: 1000, margin: "0 auto", minHeight: "100vh", background: "#f6f1e6",
        fontFamily: "'Manrope', sans-serif", position: "relative",
      }}>
      {detailHabit ? (
        <HabitDetail habit={detailHabit} onBack={actions.closeHabitDetail} />
      ) : (
        <>
          {page === "tracker" && <HabitTracker state={state} actions={actions} />}
          {page === "grove" && <TheGrove state={state} actions={actions} />}
          {page === "stats" && <StatsPage state={state} actions={actions} />}
          {page === "planner" && <Planner state={state} actions={actions} />}
          {page === "plans" && <PlansPage state={state} actions={actions} />}
        </>
      )}
      <TabBar page={page} setPage={setPage} />
      {showPaywall && <Paywall onClose={() => setShowPaywall(false)} onSubscribe={actions.subscribe} />}

      {/* invisible tap zone — tap 7 times fast to reveal Creator Mode; nothing shows here otherwise */}
      <div onClick={handleSecretTap} style={{
        position: "fixed", top: 0, left: 0, width: 44, height: 44, zIndex: 70, cursor: "default",
      }} />

      {creatorAccessUnlocked && (
        <button onClick={toggleCreatorMode} title="Creator mode: free Pro + unlimited points, just for you" style={{
          position: "fixed", top: 14, right: 14, zIndex: 60, border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 999,
          background: creatorMode ? "var(--forest-900)" : "var(--parchment-100)",
          color: creatorMode ? "var(--gold-500)" : "var(--bark-700)",
          fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 11,
          boxShadow: "var(--shadow-card)",
        }}>
          🌱 {creatorMode ? "Creator mode: ON" : "Creator mode: OFF"}
        </button>
      )}

      {saveStatus && (
        <div style={{
          position: "fixed", top: 14, left: 14, zIndex: 60, padding: "6px 11px", borderRadius: 999,
          background: "rgba(21,56,38,0.85)", color: saveStatus === "error" ? "var(--blush-400)" : "var(--gold-500)",
          fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 10,
          boxShadow: "var(--shadow-card)", pointerEvents: "none",
        }}>
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save failed"}
        </div>
      )}

      {showQuoteOfDay && (
        <Modal onClose={() => setShowQuoteOfDay(false)}>
          <div style={{
            textAlign: "center", padding: "10px 4px 4px",
          }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 64, display: "inline-block", animation: "quote-dragon-hop 2.6s ease-in-out infinite" }}>🐲</span>
              <style>{`@keyframes quote-dragon-hop { 0%,60%,100% { transform: translateY(0); } 80% { transform: translateY(-6px); } }`}</style>
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(233,196,106,0.2)",
              color: "var(--gold-600)", padding: "5px 12px", borderRadius: 999,
              fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 11,
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14,
            }}><Sparkles size={12} /> Quote of the day</div>
            <p style={{
              fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 20, lineHeight: 1.4,
              color: "var(--forest-900)", margin: "0 0 12px",
            }}>"{dailyQuoteOfDay().text}"</p>
            <p style={{
              fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 13, color: "var(--moss-600)", margin: "0 0 18px",
            }}>— {dailyQuoteOfDay().author}</p>
            <button onClick={() => setShowQuoteOfDay(false)} style={primaryBtnStyle}>Into the grove</button>
          </div>
        </Modal>
      )}
      </div>
    </>
  );
}
