/**
 * Bommy's brain.
 *
 * Not a phrase list — a perception → reasoning → speech pipeline:
 *
 *   1. SENSES   — APIs into every data source Hamed has (water, prayer,
 *                 calendar, finance/gold, sleep schedule, full history).
 *   2. OBSERVE  — derives salient facts from that data, each scored by
 *                 how much it matters *right now*.
 *   3. REMEMBER — a speech log: what he said and when. Topics have
 *                 cooldowns, exact sentences are never repeated back-to-back.
 *   4. SPEAK    — composes an English sentence from parts + live numbers,
 *                 so wording shifts day to day as the data shifts.
 */

// ═══════════════════════ 1. SENSES ═══════════════════════════════

function readJSON<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) as T : fallback;
  } catch { return fallback; }
}

// ── Prayer ───────────────────────────────────────────────────────
export function getPrayerTimes(): Record<string, string> {
  return readJSON<Record<string, string>>('prayer_times', {});
}

/** Prayer name if we're within 20 min after its adhan, else null */
export function getPrayerWindow(): string | null {
  const times = getPrayerTimes();
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  for (const name of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
    const t = times[name];
    if (!t) continue;
    const [h, m] = t.split(':').map(Number);
    const pMins = h * 60 + m;
    if (nowMins >= pMins && nowMins <= pMins + 20) return name.toUpperCase();
  }
  return null;
}

function minutesToPrayer(name?: string): number | null {
  if (!name) return null;
  const t = getPrayerTimes()[name];
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  const diff = h * 60 + m - (new Date().getHours() * 60 + new Date().getMinutes());
  return diff > 0 ? diff : null;
}

// ── Sleep schedule ───────────────────────────────────────────────
// Sleep time: the real calendar "sleep" event cached by CalendarResetManager.
// Wake time: Fajr — the day starts at the dawn prayer.
export function getSleepSchedule() {
  let sleepH = 21, sleepM = 0;
  const iso = localStorage.getItem('system_next_sleep_time');
  if (iso) {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) { sleepH = d.getHours(); sleepM = d.getMinutes(); }
  }
  const fajr = getPrayerTimes()['Fajr'] || '05:00';
  const [wakeH, wakeM] = fajr.split(':').map(Number);
  return { sleepH, sleepM, wakeH, wakeM };
}

/** True only between Hamed's real bedtime and his real wake time */
export function isSleepTime(): boolean {
  const { sleepH, sleepM, wakeH, wakeM } = getSleepSchedule();
  const mins = new Date().getHours() * 60 + new Date().getMinutes();
  const s = sleepH * 60 + sleepM;
  const w = wakeH * 60 + wakeM;
  return s > w ? (mins >= s || mins < w) : (mins >= s && mins < w);
}

/** Minutes until bedtime, or null if more than `within` away */
function minutesToSleep(within = 40): number | null {
  const { sleepH, sleepM } = getSleepSchedule();
  const mins = new Date().getHours() * 60 + new Date().getMinutes();
  const diff = sleepH * 60 + sleepM - mins;
  return diff > 0 && diff <= within ? diff : null;
}

/** First hour after wake time = morning greeting window */
function isMorningWindow(): boolean {
  const { wakeH, wakeM } = getSleepSchedule();
  const mins = new Date().getHours() * 60 + new Date().getMinutes();
  const w = wakeH * 60 + wakeM;
  return mins >= w && mins < w + 60;
}

// ── Water ────────────────────────────────────────────────────────
/** Expected glasses by now: 1/hr from 6am to 6pm */
export function getExpectedGlasses(goal: number): number {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  if (h < 6 || h >= 18) return 0;
  return Math.min(goal, Math.round(((h - 6 + m / 60) / 12) * goal));
}

/** Water button locked from 18:00 reset until Fajr — no nagging then */
export function isWaterGracePeriod(): boolean {
  const fajr = getPrayerTimes()['Fajr'] || '05:00';
  const [fh, fm] = fajr.split(':').map(Number);
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  return h >= 18 || h < fh || (h === fh && m < fm);
}

// ── History (long-term memory of Hamed's days) ───────────────────
type DayRecord = { water: number; focus: number; workout: number };

function getDailyHistory(): Record<string, DayRecord> {
  return readJSON<Record<string, DayRecord>>('daily_history', {});
}

function getRecentDays(n: number) {
  const hist = getDailyHistory();
  const out: (DayRecord & { iso: string })[] = [];
  for (let i = 1; i <= n + 3; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (hist[iso]) out.push({ ...hist[iso], iso });
    if (out.length === n) break;
  }
  return out;
}

interface Insights {
  daysKnown: number;
  activeDays: number;
  bestWater: { date: string; value: number } | null;
  bestFocus: { date: string; value: number } | null;
  currentWaterStreak: number;
  currentFocusStreak: number;
  longestWaterStreak: number;
  avgWaterAllTime: number;
  avgFocusAllTime: number;
  totalFocusHours: number;
}

let _cache: { ts: number; data: Insights } | null = null;

function getInsights(waterGoal: number): Insights {
  const now = Date.now();
  if (_cache && now - _cache.ts < 5 * 60 * 1000) return _cache.data;

  const hist = getDailyHistory();
  const today = new Date().toISOString().slice(0, 10);
  const entries = Object.entries(hist)
    .filter(([d]) => d < today)
    .sort((a, b) => a[0].localeCompare(b[0]));

  let bestWater: Insights['bestWater'] = null;
  let bestFocus: Insights['bestFocus'] = null;
  let longestWaterStreak = 0, wStreak = 0, fStreak = 0;
  let totalWater = 0, totalFocus = 0;

  for (const [date, day] of entries) {
    totalWater += day.water; totalFocus += day.focus;
    if (!bestWater || day.water > bestWater.value) bestWater = { date, value: day.water };
    if (!bestFocus || day.focus > bestFocus.value) bestFocus = { date, value: day.focus };
    if (day.water >= waterGoal) { wStreak++; longestWaterStreak = Math.max(longestWaterStreak, wStreak); }
    else wStreak = 0;
    fStreak = day.focus >= 60 ? fStreak + 1 : 0;
  }

  let cw = 0, cf = 0;
  for (let i = entries.length - 1; i >= 0; i--) { if (entries[i][1].water >= waterGoal) cw++; else break; }
  for (let i = entries.length - 1; i >= 0; i--) { if (entries[i][1].focus >= 60) cf++; else break; }

  const activeDays = entries.length;
  const firstDate = entries[0]?.[0];
  const data: Insights = {
    daysKnown: firstDate ? Math.floor((now - new Date(firstDate).getTime()) / 86400000) : 0,
    activeDays,
    bestWater, bestFocus,
    currentWaterStreak: cw,
    currentFocusStreak: cf,
    longestWaterStreak,
    avgWaterAllTime: activeDays ? totalWater / activeDays : 0,
    avgFocusAllTime: activeDays ? totalFocus / activeDays : 0,
    totalFocusHours: Math.round(totalFocus / 60),
  };
  _cache = { ts: now, data };
  return data;
}

function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 1) return 'YESTERDAY';
  if (days < 7) return `${days} DAYS AGO`;
  if (days < 30) return `${Math.floor(days / 7)}W AGO`;
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return months[new Date(iso).getMonth()];
}

// ── Finance / gold ───────────────────────────────────────────────
function getFinance() {
  const buckets = readJSON<Record<string, number>>('finance_buckets', {});
  let total = 0, gold = 0;
  for (const [k, v] of Object.entries(buckets)) {
    if (typeof v !== 'number') continue;
    total += v;
    if (/gold|ذهب|دهب/i.test(k)) gold += v;
  }
  return { total, gold };
}

// ── Quran reading ────────────────────────────────────────────────
const QURAN_DAILY_GOAL = 10;

function getQuranProgress(): { pagesRead: number; goal: number } {
  try {
    const p = readJSON<{ fajrDayKey: string; pagesRead: number } | null>('quran_daily_progress', null);
    if (!p) return { pagesRead: 0, goal: QURAN_DAILY_GOAL };
    const times = getPrayerTimes();
    const fajr = times['Fajr'] || '05:00';
    const [fh, fm] = fajr.split(':').map(Number);
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const d = new Date(now);
    if (nowMins < fh * 60 + fm) d.setDate(d.getDate() - 1);
    const currentKey = d.toISOString().slice(0, 10);
    if (p.fajrDayKey !== currentKey) return { pagesRead: 0, goal: QURAN_DAILY_GOAL };
    return { pagesRead: p.pagesRead, goal: QURAN_DAILY_GOAL };
  } catch { return { pagesRead: 0, goal: QURAN_DAILY_GOAL }; }
}

// ── Calendar ─────────────────────────────────────────────────────
function getTodayTaskCount(): number {
  const entries = readJSON<Record<string, { date?: string }>>('calendar_entries', {});
  const today = new Date().toISOString().slice(0, 10);
  return Object.values(entries).filter(e => e?.date === today).length;
}

// ═══════════════════════ 3. SPEECH MEMORY ════════════════════════

type SpokenLog = Record<string, number>;

const loadLog = () => readJSON<SpokenLog>('bommy_spoken_log', {});
const saveLog = (l: SpokenLog) => localStorage.setItem('bommy_spoken_log', JSON.stringify(l));
const loadRecent = () => readJSON<string[]>('bommy_recent_utterances', []);
const pushRecent = (s: string) => {
  const r = [s, ...loadRecent()].slice(0, 12);
  localStorage.setItem('bommy_recent_utterances', JSON.stringify(r));
};

// ═══════════════════════ 4. VERBALIZER ═══════════════════════════

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// ═══════════════════════ 2. OBSERVATIONS ═════════════════════════

export interface BrainInput {
  waterCount?: number;
  waterGoal: number;
  focusMinutes: number;
  nextPrayer?: string;
  page?: string;
}

interface Obs {
  id: string;         // topic key for the cooldown log
  cooldownH: number;  // hours before this topic can come up again
  salience: number;   // how much it matters right now (0..1+)
  speak: () => string;
}

function buildObservations(inp: BrainInput): Obs[] {
  const obs: Obs[] = [];
  const now = new Date();
  const h = now.getHours();
  const ins = getInsights(inp.waterGoal);
  const recent = getRecentDays(7);
  const noise = () => (Math.random() - 0.5) * 0.08;

  // ── Prayer — highest priority ────────────────────────────────
  const prayer = getPrayerWindow();
  if (prayer) {
    obs.push({
      id: `prayer-now-${prayer}-${now.toDateString()}`, cooldownH: 3, salience: 1,
      speak: () => pick([
        `${prayer} TIME — GO PRAY`,
        `ADHAN! ${prayer}`,
        `${prayer} NOW. EVERYTHING ELSE CAN WAIT`,
        `PRAYER FIRST — ${prayer}`,
      ]),
    });
  }
  const soonMins = minutesToPrayer(inp.nextPrayer);
  if (soonMins !== null && soonMins <= 15) {
    obs.push({
      id: `prayer-soon-${inp.nextPrayer}-${now.toDateString()}`, cooldownH: 2, salience: 0.72 + noise(),
      speak: () => pick([
        `${inp.nextPrayer!.toUpperCase()} IN ${soonMins} MIN`,
        `${soonMins} MIN TO ${inp.nextPrayer!.toUpperCase()} — WRAP UP`,
        `GET READY, ${inp.nextPrayer!.toUpperCase()} AT ${getPrayerTimes()[inp.nextPrayer!]}`,
      ]),
    });
  }

  // ── Water pace ───────────────────────────────────────────────
  if (!isWaterGracePeriod() && inp.waterCount !== undefined && h >= 6 && h < 18) {
    const count = inp.waterCount;
    const expected = getExpectedGlasses(inp.waterGoal);
    const behind = expected - count;

    if (count === 0 && expected >= 1) {
      obs.push({
        id: 'water-zero', cooldownH: 0.7, salience: 0.95,
        speak: () => pick([
          'ZERO WATER?? DRINK. NOW',
          `NOT ONE GLASS YET — SHOULD BE ${expected}`,
          'DRY MORNING. FIX IT — DRINK',
        ]),
      });
    } else if (behind >= 3) {
      obs.push({
        id: 'water-way-behind', cooldownH: 0.8, salience: 0.88 + noise(),
        speak: () => pick([
          `${count} GLASSES — ${behind} BEHIND SCHEDULE`,
          `SHOULD BE AT ${expected} BY NOW, YOU'RE AT ${count}`,
          `${behind} GLASSES LATE. CATCH UP`,
        ]),
      });
    } else if (behind >= 2) {
      obs.push({
        id: 'water-behind', cooldownH: 1, salience: 0.58 + noise(),
        speak: () => pick([
          `${count}/${expected} BY NOW — SIP SIP`,
          `WATER CHECK: ${behind} SHORT`,
          `PACE IS 1/HR — YOU'RE AT ${count}, NEED ${expected}`,
        ]),
      });
    }

    if (ins.bestWater && count > ins.bestWater.value) {
      obs.push({
        id: 'water-record', cooldownH: 20, salience: 0.9,
        speak: () => pick([
          `NEW RECORD! ${count} GLASSES 🎉`,
          `${count} GLASSES — BEST DAY EVER`,
          `BEAT YOUR OLD RECORD (${ins.bestWater!.value})!`,
        ]),
      });
    } else if (count >= inp.waterGoal) {
      obs.push({
        id: 'water-done', cooldownH: 8, salience: 0.5 + noise(),
        speak: () => pick([
          `${count}/${inp.waterGoal} — HYDRATION COMPLETE ✓`,
          `WATER GOAL DONE. RESPECT`,
          `${count} GLASSES IN. CLEAN DAY`,
        ]),
      });
    }

    // Comparisons against his own history
    if (recent.length >= 2 && h >= 10) {
      const yest = recent[0];
      const avg7 = recent.reduce((s, d) => s + d.water, 0) / recent.length;
      if (yest.water >= inp.waterGoal && count < inp.waterGoal * 0.4) {
        obs.push({
          id: 'water-vs-yesterday', cooldownH: 10, salience: 0.48 + noise(),
          speak: () => pick([
            `YESTERDAY: ${yest.water}. TODAY: ${count}. HMM?`,
            `YOU DID ${yest.water} YESTERDAY — WHERE'S THAT ENERGY`,
          ]),
        });
      }
      if (avg7 >= inp.waterGoal * 0.85 && count < inp.waterGoal * 0.3 && h >= 12) {
        obs.push({
          id: 'water-vs-avg', cooldownH: 10, salience: 0.42 + noise(),
          speak: () => pick([
            `YOUR WEEK AVG IS ${Math.round(avg7)} — KEEP THE BAR UP`,
            `${Math.round(avg7)}/DAY ALL WEEK, DON'T DROP IT TODAY`,
          ]),
        });
      }
    }
  }

  // ── Focus ────────────────────────────────────────────────────
  if (recent.length >= 2) {
    const avgF7 = recent.reduce((s, d) => s + d.focus, 0) / recent.length;
    if (inp.focusMinutes > avgF7 * 1.4 && avgF7 > 20) {
      obs.push({
        id: 'focus-above-avg', cooldownH: 8, salience: 0.44 + noise(),
        speak: () => pick([
          `${inp.focusMinutes}MIN TODAY — ABOVE YOUR AVERAGE`,
          `BEATING YOUR OWN PACE: ${inp.focusMinutes}MIN`,
        ]),
      });
    }
    const drought = recent.filter(d => d.focus >= 60).length === 0;
    if (drought && recent.length >= 4 && inp.focusMinutes < 30 && h >= 12 && h < 18) {
      obs.push({
        id: 'focus-drought', cooldownH: 24, salience: 0.4 + noise(),
        speak: () => pick([
          'A WHOLE WEEK, NO DEEP WORK?',
          'FOCUS STREAK: ZERO. START ONE TODAY',
        ]),
      });
    }
  }
  if (inp.focusMinutes > 150) {
    obs.push({
      id: 'focus-big-day', cooldownH: 6, salience: 0.5 + noise(),
      speak: () => pick([
        `${inp.focusMinutes} MINUTES LOCKED IN 🔥`,
        `${Math.round(inp.focusMinutes / 60 * 10) / 10} HOURS OF FOCUS TODAY`,
      ]),
    });
  }
  if (ins.bestFocus && inp.focusMinutes > ins.bestFocus.value * 0.9 && inp.focusMinutes < ins.bestFocus.value) {
    obs.push({
      id: 'focus-near-best', cooldownH: 12, salience: 0.62,
      speak: () => `${ins.bestFocus!.value - inp.focusMinutes}MIN FROM YOUR BEST DAY EVER`,
    });
  }
  if (ins.currentFocusStreak >= 5) {
    obs.push({
      id: 'focus-streak', cooldownH: 20, salience: 0.5 + noise(),
      speak: () => pick([
        `${ins.currentFocusStreak} DAYS OF FOCUS, UNBROKEN`,
        `STREAK: ${ins.currentFocusStreak} DAYS 🔥`,
      ]),
    });
  }
  if ([50, 100, 200, 500].includes(ins.totalFocusHours)) {
    obs.push({
      id: `focus-total-${ins.totalFocusHours}`, cooldownH: 48, salience: 0.8,
      speak: () => `${ins.totalFocusHours} TOTAL HOURS OF FOCUS. SINCE WE MET`,
    });
  }

  // ── Relationship milestones ──────────────────────────────────
  if ([30, 60, 100, 180, 365].includes(ins.daysKnown)) {
    obs.push({
      id: `milestone-${ins.daysKnown}`, cooldownH: 48, salience: 0.85,
      speak: () => pick([
        `${ins.daysKnown} DAYS TOGETHER 🙌`,
        `DAY ${ins.daysKnown}. STILL WATCHING YOU`,
      ]),
    });
  }
  if (ins.currentWaterStreak >= 5 && ins.currentWaterStreak === ins.longestWaterStreak) {
    obs.push({
      id: 'water-streak-record', cooldownH: 20, salience: 0.55,
      speak: () => `LONGEST WATER STREAK YET — ${ins.currentWaterStreak} DAYS`,
    });
  }

  // ── Calendar ─────────────────────────────────────────────────
  const tasks = getTodayTaskCount();
  if (tasks >= 4 && h >= 8 && h < 14) {
    obs.push({
      id: 'busy-day', cooldownH: 12, salience: 0.35 + noise(),
      speak: () => pick([
        `${tasks} TASKS TODAY — PACE YOURSELF`,
        `BUSY ONE: ${tasks} ON THE LIST`,
      ]),
    });
  }

  // ── Finance / gold — light touch ─────────────────────────────
  const fin = getFinance();
  if (fin.total > 0 && h >= 10 && h < 20) {
    obs.push({
      id: 'finance-note', cooldownH: 30, salience: 0.16 + noise(),
      speak: () => fin.gold > 0
        ? pick([
            `GOLD HOLDING: ${fin.gold.toLocaleString()} — SOLID`,
            `STACK AT ${fin.total.toLocaleString()}, GOLD ${fin.gold.toLocaleString()}`,
          ])
        : `TOTAL STACK: ${fin.total.toLocaleString()}`,
    });
  }

  // ── Quran reading ─────────────────────────────────────────────
  const qp = getQuranProgress();
  if (qp.pagesRead >= qp.goal) {
    obs.push({
      id: `quran-done-${now.toDateString()}`, cooldownH: 12, salience: 0.65 + noise(),
      speak: () => pick([
        `QURAN DONE — ${qp.goal} PAGES TODAY`,
        `${qp.pagesRead} PAGES. BARAK ALLAH FIK`,
        `QURAN CHECK COMPLETE. ${qp.pagesRead}/${qp.goal}`,
      ]),
    });
  } else if (qp.pagesRead >= 6 && h >= 14) {
    obs.push({
      id: `quran-progress-${now.toDateString()}`, cooldownH: 8, salience: 0.38 + noise(),
      speak: () => pick([
        `QURAN: ${qp.pagesRead}/${qp.goal} TODAY — KEEP GOING`,
        `${qp.goal - qp.pagesRead} MORE PAGES FOR TODAY`,
      ]),
    });
  } else if (qp.pagesRead === 0 && h >= 10 && h < 20) {
    obs.push({
      id: `quran-zero-${now.toDateString()}`, cooldownH: 6, salience: 0.45 + noise(),
      speak: () => pick([
        `NO QURAN YET TODAY`,
        `QURAN: 0/${qp.goal} — OPEN IT`,
      ]),
    });
  } else if (qp.pagesRead > 0 && qp.pagesRead < qp.goal && h >= 18) {
    obs.push({
      id: `quran-evening-${now.toDateString()}`, cooldownH: 4, salience: 0.55 + noise(),
      speak: () => pick([
        `QURAN: ${qp.pagesRead}/${qp.goal} — ${qp.goal - qp.pagesRead} LEFT`,
        `EVENING — ${qp.goal - qp.pagesRead} QURAN PAGES REMAINING`,
      ]),
    });
  }

  // ── Sleep schedule awareness ─────────────────────────────────
  const toSleep = minutesToSleep(35);
  if (toSleep !== null) {
    obs.push({
      id: `sleep-soon-${now.toDateString()}`, cooldownH: 5, salience: 0.68,
      speak: () => pick([
        `BED IN ${toSleep} MIN — WRAP UP`,
        `${toSleep} MIN TO SLEEP TIME`,
        'CLOSE THE TABS. SLEEP SOON',
      ]),
    });
  }
  if (isMorningWindow()) {
    obs.push({
      id: `morning-${now.toDateString()}`, cooldownH: 12, salience: 0.75,
      speak: () => pick([
        'MORNING! FAJR DONE?',
        `NEW DAY — DAY ${ins.daysKnown} TOGETHER`,
        'UP EARLY. I LIKE IT',
        'MORNING. WATER STARTS AT 6',
      ]),
    });
  }

  return obs;
}

// ═══════════════════════ THINK ═══════════════════════════════════

/**
 * The single entry point: perceive everything, pick the one thing most worth
 * saying right now — or stay silent. Never repeats a topic inside its
 * cooldown, never repeats a recent exact sentence, never chatters
 * more than once every ~75s.
 */
export function think(inp: BrainInput): string | null {
  const now = Date.now();
  const lastSpoke = Number(localStorage.getItem('bommy_last_spoke') || 0);
  if (now - lastSpoke < 75_000) return null;

  const log = loadLog();
  const obs = buildObservations(inp);
  for (const o of obs) {
    const last = log[o.id] ?? 0;
    if (now - last < o.cooldownH * 3600_000) o.salience *= 0.05;
  }
  obs.sort((a, b) => b.salience - a.salience);

  const top = obs[0];
  if (!top || top.salience < 0.22) return null;

  const recentSaid = loadRecent();
  let text: string | null = null;
  for (let i = 0; i < 4; i++) {
    const cand = top.speak();
    if (!recentSaid.includes(cand)) { text = cand; break; }
  }
  if (!text) return null;

  log[top.id] = now;
  saveLog(log);
  pushRecent(text);
  localStorage.setItem('bommy_last_spoke', String(now));
  return text;
}
