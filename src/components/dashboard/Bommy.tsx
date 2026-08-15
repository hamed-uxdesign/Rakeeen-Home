/**
 * Bommy — Rakeeen AI companion
 *
 * Living-creature engine:
 *  - BODY:   one continuous physics simulation (gravity, momentum, ballistic
 *            jumps, landing impact). Position is never teleported.
 *  - SENSES: event-driven awareness — scroll, clicks, route changes, water
 *            intake, dark mode, cursor idle. He reacts the moment things happen.
 *  - MIND:   internal drives (energy / curiosity / social) + duty computed from
 *            real data. Behavior is *scored and chosen*, not scripted randomly.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { think, isSleepTime, getPrayerWindow, isWaterGracePeriod, getExpectedGlasses } from './bommyBrain';

const isNightTime = isSleepTime;

// ─── Constants ───────────────────────────────────────────────────
const PX  = 5;
const GW  = 12;
const GH  = 14;
const CW  = GW * PX;  // 60
const CH  = GH * PX;  // 70

// Physics
const GRAV       = 0.32;
const WALK_ACCEL = 0.16;
const MAX_WALK   = 2.8;

// ─── Palette ─────────────────────────────────────────────────────
const T=null, K='#222C07', L='#C2DC3F', F='#617615', H='#D7EA6C';

// ─── Body frames (rows 0-8) ───────────────────────────────────────
const BODY_BASE: (string|null)[][] = [
  [T,T,K,K,K,K,K,K,K,K,T,T],
  [T,K,L,L,L,L,L,L,L,L,K,T],
  [K,L,H,L,L,L,L,L,L,L,L,K],
  [K,L,L,L,L,L,L,L,L,L,L,K], // eyes drawn here
  [K,L,L,L,L,L,L,L,L,L,L,K], // eyes drawn here
  [K,L,L,L,L,L,L,L,L,L,L,K],
];
const MOUTH_NEUTRAL: (string|null)[] = [K,L,L,F,F,F,F,F,L,L,L,K];
const MOUTH_HAPPY:   (string|null)[] = [K,L,F,F,F,F,F,F,F,F,L,K];
const MOUTH_OH:      (string|null)[] = [K,L,L,L,F,F,F,L,L,L,L,K];
const MOUTH_LINE:    (string|null)[] = [K,L,L,L,F,F,F,F,L,L,L,K];
const BODY_BOTTOM: (string|null)[][] = [
  [K,L,L,L,L,L,L,L,L,L,L,K],
  [T,K,L,L,L,L,L,L,L,L,K,T],
];

// ─── Leg frames (rows 9-13) ───────────────────────────────────────
const LEGS_STAND: (string|null)[][] = [
  [T,T,K,K,L,T,T,L,K,K,T,T],
  [T,T,T,K,L,T,T,L,K,T,T,T],
  [T,T,T,K,L,T,T,L,K,T,T,T],
  [T,T,T,K,L,T,T,L,K,T,T,T],
  [T,T,T,K,K,T,T,K,K,T,T,T],
];
const LEGS_WALK_A: (string|null)[][] = [
  [T,T,K,K,L,T,T,L,K,K,T,T],
  [T,K,L,K,T,T,T,T,L,K,T,T],
  [T,K,L,K,T,T,T,T,L,K,T,T],
  [T,K,L,L,T,T,T,L,L,K,T,T],
  [T,K,K,T,T,T,T,K,K,T,T,T],
];
const LEGS_WALK_B: (string|null)[][] = [
  [T,T,K,K,L,T,T,L,K,K,T,T],
  [T,T,K,L,L,T,T,T,K,L,T,T],
  [T,T,K,L,L,T,T,T,K,L,T,T],
  [T,T,K,L,L,T,T,T,K,L,T,T],
  [T,T,T,K,K,T,T,T,K,K,T,T],
];
// Arms gripping card edge, legs swung wide right
const LEGS_HANG_A: (string|null)[][] = [
  [T,K,L,K,T,T,T,T,K,L,K,T],
  [K,L,L,K,T,T,T,T,K,L,L,K],
  [T,T,K,L,L,K,K,L,L,K,T,T],
  [T,T,T,K,L,L,L,L,K,T,T,T],
  [T,T,T,T,K,L,L,K,T,T,T,T],
];
// Arms gripping, legs swung wide left
const LEGS_HANG_B: (string|null)[][] = [
  [T,K,L,K,T,T,T,T,K,L,K,T],
  [K,L,L,K,T,T,T,T,K,L,L,K],
  [T,K,L,L,K,K,K,L,L,K,T,T],
  [T,K,L,L,L,L,L,K,T,T,T,T],
  [T,T,K,L,L,K,T,T,T,T,T,T],
];
const LEGS_SIT: (string|null)[][] = [
  [T,T,K,K,L,T,T,L,K,K,T,T],
  [T,K,L,L,K,T,T,K,L,L,K,T],
  [T,K,L,L,L,K,K,L,L,L,K,T],
  [T,T,K,K,K,K,K,K,K,K,T,T],
  [T,T,T,T,T,T,T,T,T,T,T,T],
];

// ─── Mini pixel font 4×5 ─────────────────────────────────────────
type Glyph = number[][];
const FONT: Record<string,Glyph> = {
  'A':[[0,1,1,0],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1]],
  'B':[[1,1,0,0],[1,0,1,0],[1,1,0,0],[1,0,1,0],[1,1,0,0]],
  'C':[[0,1,1,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[0,1,1,0]],
  'D':[[1,1,0,0],[1,0,1,0],[1,0,1,0],[1,0,1,0],[1,1,0,0]],
  'E':[[1,1,1,0],[1,0,0,0],[1,1,0,0],[1,0,0,0],[1,1,1,0]],
  'F':[[1,1,1,0],[1,0,0,0],[1,1,0,0],[1,0,0,0],[1,0,0,0]],
  'G':[[0,1,1,0],[1,0,0,0],[1,0,1,1],[1,0,0,1],[0,1,1,0]],
  'H':[[1,0,0,1],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1]],
  'I':[[1,1,1,0],[0,1,0,0],[0,1,0,0],[0,1,0,0],[1,1,1,0]],
  'K':[[1,0,0,1],[1,0,1,0],[1,1,0,0],[1,0,1,0],[1,0,0,1]],
  'L':[[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,1,1,0]],
  'M':[[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1],[1,0,0,1]],
  'N':[[1,0,0,1],[1,1,0,1],[1,0,1,1],[1,0,0,1],[1,0,0,1]],
  'O':[[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],
  'P':[[1,1,0,0],[1,0,1,0],[1,1,0,0],[1,0,0,0],[1,0,0,0]],
  'R':[[1,1,0,0],[1,0,1,0],[1,1,0,0],[1,0,1,0],[1,0,0,1]],
  'S':[[0,1,1,0],[1,0,0,0],[0,1,1,0],[0,0,0,1],[1,1,1,0]],
  'T':[[1,1,1,0],[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
  'U':[[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],
  'W':[[1,0,0,1],[1,0,0,1],[1,0,1,1],[1,1,0,1],[1,0,0,1]],
  'Y':[[1,0,0,1],[1,0,0,1],[0,1,1,0],[0,0,1,0],[0,0,1,0]],
  'Z':[[1,1,1,0],[0,0,1,0],[0,1,0,0],[1,0,0,0],[1,1,1,0]],
  '!':[[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,0,0,0],[0,1,0,0]],
  '?':[[0,1,1,0],[1,0,0,1],[0,0,1,0],[0,0,0,0],[0,0,1,0]],
  ' ':[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
};
const GPX = 7;
const GGW = 4 * GPX + 3;

function drawPixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, maxChars = 999) {
  let cx = x;
  for (let i = 0; i < Math.min(text.length, maxChars); i++) {
    const g = FONT[text[i].toUpperCase()] ?? FONT[' '];
    g?.forEach((row, ry) => row.forEach((on, rx) => {
      if (on) { ctx.fillStyle = color; ctx.fillRect(cx + rx * GPX, y + ry * GPX, GPX, GPX); }
    }));
    cx += GGW;
  }
}

// ─── Math helpers ────────────────────────────────────────────────
function spring(pos: number, vel: number, target: number, k = 0.1, d = 0.72): [number, number] {
  const nv = vel + (target - pos) * k - vel * d;
  return [pos + nv, nv];
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ─── Character renderer ──────────────────────────────────────────
interface DrawOpts {
  eyeOffX: number;
  eyeOffY: number;
  blink: boolean;
  halfBlink?: boolean;
  mouth: (string|null)[];
  legs: (string|null)[][];
}

function drawBommy(ctx: CanvasRenderingContext2D, opts: DrawOpts) {
  ctx.clearRect(0, 0, CW, CH);
  [...BODY_BASE, [opts.mouth], ...BODY_BOTTOM].forEach((row, ry) => {
    const r = Array.isArray(row[0]) ? row[0] as (string|null)[] : row as (string|null)[];
    r.forEach((col, rx) => {
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(rx * PX, ry * PX, PX, PX);
    });
  });

  // Eyes
  const lx = clamp(3 + opts.eyeOffX, 2, 5) * PX;
  const rx = clamp(7 + opts.eyeOffX, 6, 9) * PX;
  const baseEY = (3 + clamp(opts.eyeOffY, -1, 1)) * PX;
  ctx.fillStyle = K;
  if (opts.blink) {
    ctx.fillRect(lx, baseEY + PX * 0.6, 2*PX, PX * 0.4);
    ctx.fillRect(rx, baseEY + PX * 0.6, 2*PX, PX * 0.4);
  } else if (opts.halfBlink) {
    ctx.fillRect(lx, baseEY + PX * 0.4, 2*PX, PX * 0.6);
    ctx.fillRect(rx, baseEY + PX * 0.4, 2*PX, PX * 0.6);
  } else {
    ctx.fillRect(lx, baseEY, 2*PX, PX);
    ctx.fillRect(lx, baseEY + PX, 2*PX, PX);
    ctx.fillRect(rx, baseEY, 2*PX, PX);
    ctx.fillRect(rx, baseEY + PX, 2*PX, PX);
  }

  // Legs
  opts.legs.forEach((row, ry) =>
    row.forEach((col, rx2) => {
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(rx2 * PX, (9 + ry) * PX, PX, PX);
    })
  );
}

// ─── System time helpers ─────────────────────────────────────────
function getHour() { return new Date().getHours(); }
function isDarkMode()  { return document.body.classList.contains('dark-theme'); }

const PIXEL_PHRASES = ['BOMMY', 'FOCUS', 'DRINK!', 'OK!', 'HI!', 'READY?', 'LETS GO'];

// ─── Props ───────────────────────────────────────────────────────
export interface BommyProps {
  page?: string;
  waterCount?: number;
  waterGoal?: number;
  focusMinutes?: number;
  isDark?: boolean;
  calendarTaskCount?: number;
  totalBalance?: number;
  quranSurah?: string;
  nextPrayer?: string;
}

// ─── Component ───────────────────────────────────────────────────
export const Bommy: React.FC<BommyProps> = ({
  page = 'home',
  waterCount,
  waterGoal,
  focusMinutes = 0,
  isDark: _isDarkProp,
  calendarTaskCount: _calendarTaskCount,
  totalBalance: _totalBalance,
  quranSurah: _quranSurah,
  nextPrayer,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const effectRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  // ── BODY: physics state. The rAF loop is the only owner — position is
  // integrated every frame and never teleported. ─────────────────
  const pos      = useRef({ x: 140, y: 0 });
  const vel      = useRef({ x: 0, y: 0 });
  const grounded = useRef(false);
  const anchorEl = useRef<HTMLElement | null>(null);   // card he's sitting on

  // Secondary motion
  const sqX = useRef(1); const sqVX = useRef(0);
  const sqY = useRef(1); const sqVY = useRef(0);
  const lean = useRef(0); const leanV = useRef(0);
  const eyeX = useRef(0); const eyeY = useRef(0);
  const facing = useRef<1|-1>(1);

  const blinkAt    = useRef(120);
  const blinkPhase = useRef(0); // 0=open 1=half 2=closed 3=half

  // ── MIND: drives. Behavior emerges from these + world state. ──
  const drives = useRef({ energy: 0.85, curiosity: 0.55, social: 0.3 });
  const mood   = useRef(0.65);

  type Action = 'idle'|'walk'|'crouch'|'jump'|'sit-card'|'nap-card'|'watch'|'nap'
              | 'night-sleep'|'flee'|'write'|'steal';
  const action       = useRef<Action>('idle');
  const actionAge    = useRef(0);
  const goal         = useRef<{ x: number; then: Action; el?: HTMLElement | null }>({ x: 140, then: 'idle' });
  const nextDecision = useRef(140);
  const happyUntil   = useRef(0);
  const spokeAtSit   = useRef(false);
  const tick         = useRef(0);

  // ── SENSES ────────────────────────────────────────────────────
  const mouse       = useRef({ x: window.innerWidth/2, y: window.innerHeight/2, lastMove: Date.now() });
  const scrollPulse = useRef(0);        // frames left of "user is scrolling"
  const scrollDir   = useRef(0);        // -1 up / 1 down
  const lastDark    = useRef(isDarkMode());
  const lastPage    = useRef(page);
  const lastWater   = useRef(waterCount ?? 0);

  // Sleep-on-card flag — set when night triggers a card-jump
  const sleepOnCardRef = useRef(false);

  // Steal behavior (kept)
  const stealTargetEl  = useRef<HTMLElement | null>(null);
  const stealOrigStyle = useRef('');
  const stealDoneRef   = useRef(false);

  // Write behavior
  const pixelPhrase = useRef('');
  const pixelChars  = useRef(0);
  const pixelPX2    = useRef(0);
  const pixelPY2    = useRef(0);

  // React state (DOM output only)
  const [cssPos,     setCssPos]     = useState({ x: 140, y: 0 });
  const [cssTf,      setCssTf]      = useState({ sx: 1, sy: 1, lean: 0 });
  const [bubble,     setBubble]     = useState<string|null>(null);
  const [showPx,     setShowPx]     = useState(false);
  const [sleeping,   setSleeping]   = useState(false);
  const [armStretch, setArmStretch] = useState(1);
  const [sleepRot,   setSleepRot]   = useState(0);
  const sleepRotRef = useRef(0);

  const bubTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const gnd = useCallback(() => window.innerHeight - CH - 18, []);

  const flash = useCallback((msg: string, ms = 3000) => {
    if (bubTimerRef.current) clearTimeout(bubTimerRef.current);
    setBubble(msg);
    bubTimerRef.current = setTimeout(() => setBubble(null), ms);
  }, []);

  // ── Voice: the brain decides what (and whether) to say ─────────
  const pickMessage = useCallback((): string | null =>
    think({ waterCount, waterGoal: waterGoal ?? 12, focusMinutes, nextPrayer, page }),
  [waterCount, waterGoal, focusMinutes, nextPrayer, page]);

  // Fresh props + picker for the (mount-once) physics loop
  const propsRef = useRef({ page, waterCount, waterGoal });
  useEffect(() => { propsRef.current = { page, waterCount, waterGoal }; });
  const pickMessageRef = useRef(pickMessage);
  useEffect(() => { pickMessageRef.current = pickMessage; });

  // ── The living loop ───────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    pos.current = { x: 140, y: gnd() };
    vel.current = { x: 0, y: 0 };
    setCssPos({ x: 140, y: gnd() });

    // ── Action helpers ─────────────────────────────────────────
    const startAction = (a: Action) => { action.current = a; actionAge.current = 0; };

    const setGoal = (x: number, then: Action, el?: HTMLElement | null) => {
      goal.current = { x, then, el };
      startAction('walk');
    };

    const detach = (hop = true) => {
      if (!anchorEl.current) return;
      anchorEl.current = null;
      setSleeping(false);
      setBubble(null);
      if (hop) {
        vel.current.y = -2.8;
        vel.current.x = (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random());
      }
      grounded.current = false;
    };

    const landSquash = (strength: number) => {
      sqX.current = 1 + strength * 0.42; sqVX.current = 0;
      sqY.current = 1 - strength * 0.3;  sqVY.current = 0;
    };

    const visibleCards = () =>
      Array.from(document.querySelectorAll<HTMLElement>('.brutalist-card, .brutalist-dashed-card'))
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.top > 70 && r.top < window.innerHeight - 90 && r.width > 90;
        });

    // Ballistic launch toward a card's top edge — real projectile arc
    const jumpTo = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const ax = r.left + r.width / 2 - CW / 2;
      const ay = r.top - 9 * PX;
      const dx = ax - pos.current.x;
      const dy = ay - pos.current.y;
      const T = clamp(Math.round(Math.hypot(dx, dy) / 7) + 18, 24, 52);
      vel.current.x = dx / T;
      vel.current.y = (dy - 0.5 * GRAV * T * T) / T;
      grounded.current = false;
    };

    const remindOnArrive = { current: false };

    // ── MIND: score candidate actions from drives + world, pick the best ──
    const decide = () => {
      if (isNightTime()) {
        // find a card to sleep on, else pick a random spot on the floor
        const cards = visibleCards();
        if (cards.length > 0) {
          const el = cards[Math.floor(Math.random() * cards.length)];
          const r = el.getBoundingClientRect();
          setGoal(r.left + r.width / 2 - CW / 2, 'crouch', el);
          // flag so on-card landing triggers night sleep instead of sit-card
          sleepOnCardRef.current = true;
        } else {
          startAction('night-sleep');
        }
        return;
      }

      const d = drives.current;
      const p = propsRef.current;
      const idleMins = (Date.now() - mouse.current.lastMove) / 60000;

      // Duty — computed live from real data
      let duty = 0;
      if (getPrayerWindow()) duty = 1;
      else if (!isWaterGracePeriod() && p.waterCount !== undefined) {
        const behind = getExpectedGlasses(p.waterGoal ?? 12) - p.waterCount;
        if (behind >= 3) duty = 0.9;
        else if (behind >= 2) duty = 0.6;
        else if (behind >= 1) duty = 0.3;
      }

      const cards = visibleCards();
      const n = () => (Math.random() - 0.5) * 0.3;

      const scores: [string, number][] = [
        ['card',   (cards.length ? 0.9 + d.curiosity * 2.2 : 0) + n()],
        ['watch',  (idleMins < 0.25 ? d.social * 1.1 : 0) + n()],
        ['remind', duty * 2.3 + n()],
        ['write',  (mood.current > 0.72 ? 0.15 : 0) + n()],
        ['wander', 0.18 + n()],
        ['idle',   0.3 + n()],
      ];
      scores.sort((a, b) => b[1] - a[1]);
      const choice = scores[0][0];

      switch (choice) {
        case 'nap':
          startAction('nap');
          break;
        case 'card': {
          const el = cards[Math.floor(Math.random() * cards.length)];
          const r = el.getBoundingClientRect();
          setGoal(r.left + r.width / 2 - CW / 2, 'crouch', el);
          break;
        }
        case 'watch':
          startAction('watch');
          break;
        case 'remind':
          setGoal(window.innerWidth * (0.35 + Math.random() * 0.3), 'idle');
          goal.current.then = 'idle';
          // speak on arrival — handled in walk arrive via remindFlag
          remindOnArrive.current = true;
          break;
        case 'write': {
          const phrase = PIXEL_PHRASES[Math.floor(Math.random() * PIXEL_PHRASES.length)];
          pixelPhrase.current = phrase;
          const tw = phrase.length * GGW;
          pixelPX2.current = Math.max(20, window.innerWidth / 2 - tw / 2);
          pixelPY2.current = gnd() - 5 * GPX - 28;
          setGoal(pixelPX2.current - 24, 'write');
          break;
        }
        case 'wander':
          setGoal(50 + Math.random() * (window.innerWidth - CW - 100), 'idle');
          break;
        default:
          startAction('idle');
          nextDecision.current = 180 + Math.random() * 260;
      }
    };

    // ── SENSES: event listeners ────────────────────────────────
    const onMouse = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      mouse.current.lastMove = Date.now();
      drives.current.social = Math.min(1, drives.current.social + 0.0015);
    };
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      scrollDir.current = window.scrollY > lastScrollY ? 1 : -1;
      lastScrollY = window.scrollY;
      scrollPulse.current = 14;
    };
    const onClick = (e: MouseEvent) => {
      const cx = pos.current.x + CW / 2;
      const cy = pos.current.y + CH / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (anchorEl.current && anchorEl.current.contains(e.target as Node)) {
        // user poked the card he's sitting on — startled hop off
        detach();
        startAction('idle');
        nextDecision.current = 50;
      } else if (dist < 120 && action.current !== 'steal') {
        startAction('flee');
      } else if (action.current === 'nap' && dist < 420) {
        startAction('idle');
        nextDecision.current = 40;
      }
    };
    // ── SENSES: system-wide data changes ──────────────────────
    const IGNORE = new Set([
      'bommy_spoken_log','bommy_recent_utterances','bommy_last_spoke','bommy_steal_date',
      'is_reset_v1',
    ]);
    let lastReact = 0;

    // Find user avatar/photo in the DOM
    const findAvatar = (): HTMLElement | null =>
      document.querySelector<HTMLElement>(
        'img.user-avatar, img[alt*="profile"], img[alt*="user"], .avatar img, .user-photo, [class*="avatar"], [class*="user-pic"]'
      );

    const onDataChange = (e: Event) => {
      const { key } = (e as CustomEvent<{ key: string; value: string }>).detail;
      if (IGNORE.has(key)) return;
      const now = Date.now();
      if (now - lastReact < 8000) return; // max once per 8s
      lastReact = now;

      const a = action.current;
      if (a === 'steal' || a === 'night-sleep' || a === 'nap-card') return;

      // Subtle curiosity bump — always, silently
      drives.current.curiosity = Math.min(1, drives.current.curiosity + 0.15);

      if (/finance|bucket|bank|gold|ذهب|دهب/i.test(key)) {
        // Finance changed — walk near it quietly, maybe flash once
        if (Math.random() < 0.4) flash('MONEY MOVED.', 2000);
        else nextDecision.current = Math.min(nextDecision.current, 60);

      } else if (/calendar|event|task/i.test(key)) {
        // Calendar changed — get curious, no loud reaction
        nextDecision.current = Math.min(nextDecision.current, 60);

      } else if (/hydration|water|glass/i.test(key)) {
        // handled by prop diff already

      } else if (/prayer|adhan/i.test(key)) {
        // silent — brain will handle at next speak window

      } else if (/sleep|wake|system_next/i.test(key)) {
        // silent — schedule changes happen often, never flash

      } else {
        // anything else — maybe go stand on the avatar and watch quietly
        if (Math.random() < 0.3) {
          const avatar = findAvatar();
          if (avatar) {
            const r = avatar.getBoundingClientRect();
            if (r.width > 0) {
              if (anchorEl.current) detach(false);
              setGoal(r.left + r.width / 2 - CW / 2, 'idle');
            }
          }
        }
      }
    };

    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('click', onClick, { passive: true });
    window.addEventListener('bommy:change', onDataChange);

    const initTimer = setTimeout(() => decide(), 1500);

    let lastX = 140, lastY = gnd();
    let lastSX = 1, lastSY = 1, lastLean = 0, lastSR = 0;

    function loop() {
      const t = ++tick.current;
      const age = ++actionAge.current;
      const a = action.current;
      const g = gnd();
      const p = propsRef.current;
      const d = drives.current;

      // ── SENSES: prop-change reactions (he notices, immediately) ──
      if (p.page !== lastPage.current) {
        lastPage.current = p.page;
        d.curiosity = Math.min(1, d.curiosity + 0.35);
        if (anchorEl.current) detach();
        if (a !== 'steal') { startAction('idle'); nextDecision.current = 45; }
      }
      if ((p.waterCount ?? 0) > lastWater.current) {
        mood.current = Math.min(1, mood.current + 0.08);
        happyUntil.current = t + 150;
        if (grounded.current && !anchorEl.current && a !== 'steal') vel.current.y = -3.4;
      }
      lastWater.current = p.waterCount ?? 0;

      const nowDark = isDarkMode();
      if (nowDark !== lastDark.current) {
        lastDark.current = nowDark;
        flash(nowDark ? 'DARK MODE!' : 'LIGHT MODE!');
      }

      // Steal trigger — every frame (time-window based)
      if (!stealDoneRef.current && a !== 'steal') {
        const hh = getHour(), mm = new Date().getMinutes();
        if (hh === 18 && mm >= 0 && mm < 5) { detach(false); startAction('steal'); }
      }

      // Night — interrupt and go sleep on a card
      if (isNightTime() && a !== 'night-sleep' && a !== 'nap-card' && a !== 'steal'
          && !(a === 'walk' && sleepOnCardRef.current) && t % 90 === 0) {
        detach(false);
        decide();
      }

      // ── MIND: drives evolve continuously ──────────────────────
      if (a === 'walk' || a === 'jump' || a === 'flee') d.energy = Math.max(0, d.energy - 0.00012);
      else if (a === 'nap')          d.energy = Math.min(1, d.energy + 0.0007);
      else if (a === 'nap-card')     d.energy = Math.min(1, d.energy + 0.0005);
      else if (a === 'night-sleep')  d.energy = Math.min(1, d.energy + 0.0004);
      else                           d.energy = Math.max(0, d.energy - 0.00003);

      d.curiosity = Math.min(1, d.curiosity + 0.00008);
      if (a === 'sit-card') d.curiosity = Math.max(0, d.curiosity - 0.0003);
      if (a === 'nap-card') d.curiosity = Math.max(0, d.curiosity - 0.0001);

      const mouseDist = Math.hypot(
        mouse.current.x - (pos.current.x + CW/2),
        mouse.current.y - (pos.current.y + CH/2),
      );
      if (Date.now() - mouse.current.lastMove > 4000) d.social = Math.max(0, d.social - 0.0001);
      if (a === 'watch') d.social = Math.max(0, d.social - 0.0009);

      mood.current = lerp(mood.current, 0.6 + d.energy * 0.15, 0.001);

      // ── Blink (4-phase) ───────────────────────────────────────
      if (t >= blinkAt.current) {
        blinkPhase.current = (blinkPhase.current + 1) % 4;
        blinkAt.current = t + (blinkPhase.current === 0
          ? 100 + Math.random() * 170
          : blinkPhase.current === 2 ? 3 + Math.random() * 3 : 3);
      }
      const blink = blinkPhase.current === 2;
      const halfBlink = blinkPhase.current === 1 || blinkPhase.current === 3;

      // ── Eyes track cursor; scroll pulls gaze vertically ───────
      const mdx = mouse.current.x - (pos.current.x + CW/2);
      const mdy = mouse.current.y - (pos.current.y + CH/2);
      let targetEX = mouseDist < 340 ? clamp(Math.round(mdx / 90), -1, 1) : 0;
      let targetEY = mouseDist < 340 ? clamp(Math.round(mdy / 110), -1, 1) : 0;
      if (scrollPulse.current > 0) { scrollPulse.current--; targetEY = scrollDir.current; }
      eyeX.current = lerp(eyeX.current, targetEX, 0.06);
      eyeY.current = lerp(eyeY.current, targetEY, 0.06);

      // ── Squash + lean springs ─────────────────────────────────
      [sqX.current, sqVX.current] = spring(sqX.current, sqVX.current, 1, 0.2, 0.68);
      [sqY.current, sqVY.current] = spring(sqY.current, sqVY.current, 1, 0.2, 0.68);
      const walking = Math.abs(vel.current.x) > 0.25 && grounded.current;
      const targetLean = walking ? -facing.current * 5 : 0;
      [lean.current, leanV.current] = spring(lean.current, leanV.current, targetLean, 0.08, 0.76);

      // ── ACTION LOGIC ──────────────────────────────────────────
      let mouth = MOUTH_NEUTRAL;
      let legs  = LEGS_STAND;
      let eyeOverrideY: number | null = null;

      if (a === 'idle') {
        if (--nextDecision.current <= 0) decide();
      }

      else if (a === 'walk') {
        const dx = goal.current.x - pos.current.x;
        if (grounded.current) {
          vel.current.x += Math.sign(dx) * WALK_ACCEL;
          vel.current.x = clamp(vel.current.x, -MAX_WALK, MAX_WALK);
        }
        if (Math.abs(dx) < 7 && Math.abs(vel.current.x) < 0.45 && grounded.current) {
          vel.current.x = 0;
          const then = goal.current.then;
          if (then === 'crouch' && goal.current.el) {
            startAction('crouch');
          } else if (then === 'write') {
            pixelChars.current = 0;
            setShowPx(true);
            startAction('write');
          } else if (then === 'night-sleep') {
            startAction('night-sleep');
          } else {
            if (remindOnArrive.current) {
              remindOnArrive.current = false;
              const msg = pickMessageRef.current();
              if (msg) flash(msg, 3800);
            }
            startAction('idle');
            nextDecision.current = 220 + Math.random() * 240;
          }
        }
        if (age > 900) { startAction('idle'); nextDecision.current = 60; } // stuck failsafe
      }

      else if (a === 'crouch') {
        sqY.current = lerp(sqY.current, 0.72, 0.16);
        sqX.current = lerp(sqX.current, 1.2, 0.16);
        legs = LEGS_SIT;
        eyeOverrideY = -1; // looks up at the card
        if (age >= 13) {
          if (goal.current.el) jumpTo(goal.current.el);
          startAction('jump');
        }
      }

      else if (a === 'jump') {
        mouth = MOUTH_OH;
        legs  = LEGS_HANG_A; // limbs spread mid-air
        const el = goal.current.el;
        if (el) {
          const r = el.getBoundingClientRect();
          const ax = r.left + r.width / 2 - CW / 2;
          const ay = r.top - 9 * PX;
          if (vel.current.y > 0 && pos.current.y >= ay - 6 && Math.abs(pos.current.x - ax) < 30) {
            anchorEl.current = el;
            vel.current = { x: 0, y: 0 };
            landSquash(0.7);
            spokeAtSit.current = false;
            if (sleepOnCardRef.current) {
              sleepOnCardRef.current = false;
              startAction('nap-card');
            } else {
              startAction('sit-card');
            }
          }
        }
        if (grounded.current && age > 6) { // missed — landed on ground
          startAction('idle');
          nextDecision.current = 60;
        }
      }

      else if (a === 'sit-card') {
        const swing = Math.sin(age * 0.035) * 0.35;
        legs  = age < 16 ? LEGS_SIT : (Math.floor(t / 34) % 2 ? LEGS_HANG_A : LEGS_HANG_B);
        mouth = age > 20 ? MOUTH_HAPPY : MOUTH_NEUTRAL;

        const lookPhase = Math.floor(age / 120) % 5;
        if (lookPhase === 1)      eyeX.current = lerp(eyeX.current, -1, 0.05);
        else if (lookPhase === 2) eyeX.current = lerp(eyeX.current,  1, 0.05);
        else                      eyeX.current = lerp(eyeX.current, swing * 0.5, 0.04);

        if (age === 95 && !spokeAtSit.current) {
          spokeAtSit.current = true;
          if (Math.random() < 0.6) {
            const msg = pickMessageRef.current();
            if (msg) flash(msg, 3600);
          }
        }

        // leaves when curiosity satisfied (drive-driven, not a fixed timer)
        if (age > 1200 && d.curiosity < 0.08) { detach(); startAction('idle'); nextDecision.current = 120; }
        if (age > 5000) { detach(); startAction('idle'); nextDecision.current = 120; }
      }

      else if (a === 'nap-card') {
        const nightMode = isNightTime();
        // tilt to side like a sleeping person, keep normal proportions
        sleepRotRef.current = lerp(sleepRotRef.current, 82, 0.04);
        sqX.current = lerp(sqX.current, 1, 0.06);
        sqY.current = lerp(sqY.current, 1, 0.06);
        legs  = LEGS_SIT;
        mouth = MOUTH_LINE;
        setSleeping(true);
        // gentle breathing bob via slight rotation oscillation
        sleepRotRef.current += Math.sin(t * (nightMode ? 0.01 : 0.015)) * 0.4;
        eyeX.current = lerp(eyeX.current, 0, 0.02);
        eyeY.current = lerp(eyeY.current, 0, 0.02);
        if (age === 60) flash('zzz...', 99999);
        // card disappeared — fall off
        if (!anchorEl.current) {
          setSleeping(false); setBubble(null);
          sleepRotRef.current = 0;
          startAction('idle'); nextDecision.current = 60;
        }
        if (nightMode) {
          // deep night sleep — only wakes at real wake time
          if (age % 300 === 0 && !isNightTime()) {
            setSleeping(false); setBubble(null);
            sleepRotRef.current = 0;
            detach(false);
            const msg = pickMessageRef.current();
            if (msg) flash(msg, 3000);
            startAction('idle'); nextDecision.current = 150;
          }
        } else {
          // daytime nap — wakes if cursor gets very close
          if (age % 200 === 0 && mouseDist < 150) {
            setSleeping(false); setBubble(null);
            sleepRotRef.current = 0;
            startAction('sit-card'); spokeAtSit.current = false;
          }
          if (age > 3600) {
            setSleeping(false); setBubble(null);
            sleepRotRef.current = 0;
            startAction('sit-card'); spokeAtSit.current = false;
          }
        }
      }

      else if (a === 'watch') {
        // faces the cursor, tracks hard; steps closer when it's far
        facing.current = mdx > 0 ? 1 : -1;
        eyeX.current = lerp(eyeX.current, clamp(mdx / 60, -1, 1), 0.12);
        eyeY.current = lerp(eyeY.current, clamp(mdy / 80, -1, 1), 0.12);
        if (mouseDist > 430 && grounded.current && age % 40 < 14) {
          vel.current.x += Math.sign(mdx) * WALK_ACCEL * 0.7;
          vel.current.x = clamp(vel.current.x, -MAX_WALK * 0.6, MAX_WALK * 0.6);
        }
        if (age > 320 + Math.random() * 220 || Date.now() - mouse.current.lastMove > 8000) {
          startAction('idle'); nextDecision.current = 80;
        }
      }

      else if (a === 'night-sleep') {
        // fallback: no cards found — sleep on floor in corner
        legs  = LEGS_SIT;
        mouth = MOUTH_LINE;
        setSleeping(true);
        const br = 1 + Math.sin(t * 0.018) * 0.06;
        sqX.current = lerp(sqX.current, 1.5, 0.02);
        sqY.current = lerp(sqY.current, 0.55, 0.02);
        sqX.current *= br;
        if (age === 80) flash('zzz...', 99999);
        // try to find a card if one appears
        if (age % 300 === 0 && isNightTime()) {
          const cards = visibleCards();
          if (cards.length > 0) {
            setSleeping(false); setBubble(null);
            sleepOnCardRef.current = true;
            decide();
          }
        }
        if (age % 300 === 0 && !isNightTime()) {
          setSleeping(false); setBubble(null);
          sqX.current = 1; sqY.current = 1;
          const msg = pickMessageRef.current();
          if (msg) flash(msg, 3000);
          startAction('idle'); nextDecision.current = 150;
        }
      }

      else if (a === 'flee') {
        mouth = MOUTH_OH;
        const away: 1|-1 = mdx > 0 ? -1 : 1;
        facing.current = away;
        if (grounded.current) {
          vel.current.x += away * WALK_ACCEL * 4;
          vel.current.x = clamp(vel.current.x, -2.5, 2.5);
        }
        if (age > 70 || mouseDist > 280) { startAction('idle'); nextDecision.current = 100; }
      }

      else if (a === 'write') {
        mouth = MOUTH_HAPPY;
        eyeX.current = lerp(eyeX.current, 1, 0.1);
        if (age > 22 && age % 11 === 0) {
          pixelChars.current = Math.min(pixelPhrase.current.length, pixelChars.current + 1);
        }
        const ec = effectRef.current;
        if (ec) {
          const ectx = ec.getContext('2d')!;
          ectx.clearRect(0, 0, ec.width, ec.height);
          if (pixelChars.current > 0) {
            const color = isDarkMode() ? '#C2DC3F' : '#222C07';
            drawPixelText(ectx, pixelPhrase.current, pixelPX2.current, pixelPY2.current, color, pixelChars.current);
          }
        }
        if (age > 30 + pixelPhrase.current.length * 11 + 90) {
          pixelPhrase.current = '';
          setShowPx(false);
          startAction('idle');
          nextDecision.current = 200;
        }
      }

      else if (a === 'steal') {
        if (age === 1) {
          stealDoneRef.current = true;
          localStorage.setItem('bommy_steal_date', new Date().toDateString());
          const bx = pos.current.x + CW / 2;
          const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'))
            .filter(el => {
              const r = el.getBoundingClientRect();
              return r.width > 40 && r.height > 30 && r.top > 60 && r.top < window.innerHeight - 60;
            })
            .sort((el1, el2) => {
              const r1 = el1.getBoundingClientRect(), r2 = el2.getBoundingClientRect();
              return Math.abs(r1.left + r1.width/2 - bx) - Math.abs(r2.left + r2.width/2 - bx);
            });
          stealTargetEl.current = candidates[0] ?? null;
          if (stealTargetEl.current) stealOrigStyle.current = stealTargetEl.current.style.cssText;
        }

        if (age < 15) {
          sqY.current = lerp(sqY.current, 0.75, 0.12);
          sqX.current = lerp(sqX.current, 1.25, 0.12);
          legs = LEGS_SIT; eyeOverrideY = 1;
        } else if (age < 55) {
          const pr = (age - 15) / 40;
          setArmStretch(1 + pr * 1.8);
          sqX.current = lerp(sqX.current, 0.55, 0.06);
          sqY.current = lerp(sqY.current, 1, 0.1);
          mouth = MOUTH_OH; legs = LEGS_HANG_A; eyeOverrideY = -1;
        } else if (age === 55 && stealTargetEl.current) {
          const el = stealTargetEl.current;
          const r  = el.getBoundingClientRect();
          const dir = r.left + r.width/2 > window.innerWidth / 2 ? 1 : -1;
          el.style.transition = 'transform 0.5s cubic-bezier(0.68,-0.55,0.27,1.55), opacity 0.5s';
          el.style.transform  = `translateX(${dir * 180}px) translateY(-90px) rotate(${dir * 25}deg)`;
          el.style.opacity    = '0.35';
          flash("6PM. LOCKED IN FOR TONIGHT 🔒", 4000);
          mouth = MOUTH_HAPPY; legs = LEGS_HANG_B;
        } else if (age < 120) {
          mouth = MOUTH_HAPPY; legs = LEGS_HANG_B; eyeOverrideY = -1;
        } else if (age < 160) {
          const pr = 1 - (age - 120) / 40;
          setArmStretch(1 + pr * 1.8);
          sqX.current = lerp(sqX.current, 1, 0.1);
          mouth = MOUTH_HAPPY;
        } else if (age === 160 && stealTargetEl.current) {
          const el = stealTargetEl.current;
          el.style.transition = 'transform 0.6s ease, opacity 0.6s';
          el.style.transform  = '';
          el.style.opacity    = '';
          setTimeout(() => {
            if (stealTargetEl.current) {
              stealTargetEl.current.style.cssText = stealOrigStyle.current;
              stealTargetEl.current = null;
            }
          }, 700);
          setArmStretch(1);
        }
        if (age > 220) { startAction('idle'); nextDecision.current = 200; }
      }

      // ── BODY: physics integration (single source of truth) ────
      if (anchorEl.current) {
        const r = anchorEl.current.getBoundingClientRect();
        const stillThere = r.width > 60 && r.top > -CH && r.top < window.innerHeight - 30;
        if (!stillThere) {
          detach(); // falls with gravity, lands on ground
          startAction('idle');
          nextDecision.current = 70;
        } else {
          // tight spring onto the card — follows scroll with a hint of organic lag
          const ax = r.left + r.width / 2 - CW / 2;
          const ay = r.top - 9 * PX;
          pos.current.x = lerp(pos.current.x, ax, 0.42);
          pos.current.y = lerp(pos.current.y, ay, 0.42);
        }
      } else if (a !== 'steal') {
        vel.current.y += GRAV;
        vel.current.x *= grounded.current ? 0.86 : 0.985;
        pos.current.x += vel.current.x;
        pos.current.y += vel.current.y;

        if (pos.current.y >= g) {
          if (vel.current.y > 2.4) landSquash(Math.min(1, vel.current.y / 9));
          pos.current.y = g;
          vel.current.y = 0;
          grounded.current = true;
        } else grounded.current = false;

        const minX = -CW * 0.35, maxX = window.innerWidth - CW * 0.65;
        if (pos.current.x < minX) { pos.current.x = minX; vel.current.x = Math.abs(vel.current.x) * 0.3; }
        if (pos.current.x > maxX) { pos.current.x = maxX; vel.current.x = -Math.abs(vel.current.x) * 0.3; }
      }

      if (vel.current.x >  0.15) facing.current =  1;
      if (vel.current.x < -0.15) facing.current = -1;

      // ── RENDER ────────────────────────────────────────────────
      if (happyUntil.current > t && a !== 'nap' && a !== 'night-sleep') mouth = MOUTH_HAPPY;
      else if (mood.current < 0.35 && mouth === MOUTH_NEUTRAL) mouth = MOUTH_LINE;

      if (legs === LEGS_STAND) {
        const speed = Math.abs(vel.current.x);
        if (!grounded.current && !anchorEl.current) legs = LEGS_HANG_A;
        else if (speed > 0.3) {
          const rate = Math.max(6, Math.round(15 - speed * 4));
          legs = Math.floor(t / rate) % 2 ? LEGS_WALK_A : LEGS_WALK_B;
          if (speed > 0.8) sqY.current = 1 + (Math.floor(t / rate) % 2 ? 0.04 : -0.02);
        }
      }

      drawBommy(ctx, {
        eyeOffX: Math.round(eyeX.current) * facing.current,
        eyeOffY: eyeOverrideY ?? Math.round(eyeY.current),
        blink: blink || (a === 'nap' && age > 90) || a === 'night-sleep' || (a === 'nap-card' && age > 40),
        halfBlink: halfBlink || (a === 'nap' && age > 40 && age <= 90) || (a === 'nap-card' && age > 20 && age <= 40),
        mouth, legs,
      });

      // ── Commit to DOM ─────────────────────────────────────────
      if (Math.abs(pos.current.x - lastX) > 0.3 || Math.abs(pos.current.y - lastY) > 0.3) {
        lastX = pos.current.x; lastY = pos.current.y;
        setCssPos({ x: pos.current.x, y: pos.current.y });
      }
      const sx = sqX.current * facing.current;
      const sy = sqY.current;
      const ln = lean.current;
      if (Math.abs(sx - lastSX) > 0.005 || Math.abs(sy - lastSY) > 0.005 || Math.abs(ln - lastLean) > 0.08) {
        lastSX = sx; lastSY = sy; lastLean = ln;
        setCssTf({ sx, sy, lean: ln });
      }
      const sr = sleepRotRef.current;
      if (Math.abs(sr - lastSR) > 0.5) { lastSR = sr; setSleepRot(sr); }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(initTimer);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('click', onClick);
      window.removeEventListener('bommy:change', onDataChange);
      if (bubTimerRef.current) clearTimeout(bubTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {showPx && (
        <canvas
          ref={effectRef}
          width={window.innerWidth}
          height={window.innerHeight}
          style={{ position:'fixed', top:0, left:0, zIndex:8990, pointerEvents:'none', imageRendering:'pixelated', display:'none' }}
        />
      )}

      <div
        style={{
          position: 'fixed',
          left: cssPos.x,
          top:  cssPos.y,
          zIndex: 9000,
          pointerEvents: 'none',
          transform: `scaleX(${cssTf.sx}) scaleY(${cssTf.sy * armStretch}) rotate(${cssTf.lean + sleepRot}deg)`,
          transformOrigin: sleepRot > 5 ? '50% 50%' : '50% 0%',
          willChange: 'transform, left, top',
          opacity: sleeping ? 0.7 : 1,
          transition: 'opacity 1.2s ease',
          display: 'none',
        }}
      >
        {bubble && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: `translateX(-50%) scaleX(${facing.current})`,
            marginBottom: 10,
            background: 'var(--paper-dark, #fff)',
            border: '1.5px solid var(--ink, #222C07)',
            padding: '5px 10px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.1em',
            whiteSpace: 'pre',
            textAlign: 'center',
            color: 'var(--ink, #222C07)',
            lineHeight: 1.5,
            textTransform: 'uppercase',
            pointerEvents: 'none',
            animation: 'bommyBubble .15s ease-out',
          }}>
            {bubble}
            <span style={{
              position:'absolute', top:'100%', left:'50%',
              transform:'translateX(-50%)', width:0, height:0,
              borderLeft:'5px solid transparent', borderRight:'5px solid transparent',
              borderTop:'6px solid var(--ink, #222C07)',
            }} />
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={CW} height={CH}
          style={{ imageRendering:'pixelated', display:'block', width:CW, height:CH }}
        />
      </div>
    </>
  );
};
