import { useState, useEffect, useRef } from 'react';

// ─── Dot-matrix digit data (5 rows × 4 cols) ──────────────────────────────
export const DM: Record<string, number[][]> = {
  '0':[[1,1,1,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,1,1,1]],
  '1':[[0,0,1,0],[0,1,1,0],[0,0,1,0],[0,0,1,0],[0,1,1,1]],
  '2':[[1,1,1,1],[0,0,0,1],[1,1,1,1],[1,0,0,0],[1,1,1,1]],
  '3':[[1,1,1,1],[0,0,0,1],[0,1,1,1],[0,0,0,1],[1,1,1,1]],
  '4':[[1,0,0,1],[1,0,0,1],[1,1,1,1],[0,0,0,1],[0,0,0,1]],
  '5':[[1,1,1,1],[1,0,0,0],[1,1,1,1],[0,0,0,1],[1,1,1,1]],
  '6':[[1,1,1,1],[1,0,0,0],[1,1,1,1],[1,0,0,1],[1,1,1,1]],
  '7':[[1,1,1,1],[0,0,0,1],[0,0,1,0],[0,1,0,0],[0,1,0,0]],
  '8':[[1,1,1,1],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,1,1,1]],
  '9':[[1,1,1,1],[1,0,0,1],[1,1,1,1],[0,0,0,1],[0,0,0,1]],
};

// Single responsive SVG that renders MM:SS in dot-matrix, scales via viewBox.
// Supports 2 or 3 digit minutes (e.g. 99:59 or 130:00).
export const DMTimer: React.FC<{ mm: string; ss: string; color: string; maxWidth?: string }> = ({
  mm, ss, color, maxWidth = 'min(88vw, 540px)'
}) => {
  const mS = 28; const mR = 10;
  const sS = 17; const sR = 6;
  const mH = 4 * mS;
  const sH = 4 * sS;
  const sOffY = (mH - sH) / 2;
  const digitBlockW = 3 * mS + mR * 2; // width occupied by one digit block

  // Build x-positions for each mm digit dynamically
  const mmChars = mm.length === 3 ? [mm[0], mm[1], mm[2]] : [mm[0] ?? '0', mm[1] ?? '0'];
  const mmXPositions: number[] = [];
  let curX = 0;
  mmChars.forEach((_, i) => {
    mmXPositions.push(curX);
    curX += digitBlockW + (i < mmChars.length - 1 ? 18 : 10);
  });

  const xCol  = curX;
  const colCX = xCol + mR * 1.5;
  const xSS0  = xCol + mR * 3 + 14;
  const xSS1  = xSS0 + 3 * sS + sR * 2 + 14;
  const totalW = xSS1 + 3 * sS;
  const pad = mR + 4;

  const renderDigit = (digit: string, tx: number, ty: number, step: number, r: number) =>
    (DM[digit] ?? DM['0']).flatMap((row, ri) =>
      row.map((val, ci) => (
        <circle key={`${tx}-${ri}-${ci}`}
          cx={tx + ci * step} cy={ty + ri * step} r={r}
          fill={color} opacity={val ? 1 : 0.07}
          style={val ? {
            animation: 'dotPulse 2.4s ease-in-out infinite',
            animationDelay: `${(ri * 4 + ci) * 0.06}s`,
          } : undefined} />
      ))
    );

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${totalW + pad * 2} ${mH + pad * 2}`}
      style={{ width: maxWidth, height: 'auto' }}
      overflow="visible"
    >
      {mmChars.map((ch, i) => renderDigit(ch, mmXPositions[i], 0, mS, mR))}
      <circle cx={colCX} cy={mH * 0.3} r={mR} fill={color} opacity={0.4} />
      <circle cx={colCX} cy={mH * 0.7} r={mR} fill={color} opacity={0.4} />
      {renderDigit(ss[0], xSS0, sOffY, sS, sR)}
      {renderDigit(ss[1], xSS1, sOffY, sS, sR)}
    </svg>
  );
};

// Wavy progress bar — phase animates via RAF; pct is smoothly interpolated between updates.
export const WavyProgressBar: React.FC<{
  pct: number;
  isOvertime: boolean;
  mode: string;
  running?: boolean;
  totalSecs?: number;
}> = ({ pct, isOvertime, mode }) => {
  const [phase, setPhase] = useState(0);
  const [smoothPct, setSmoothPct] = useState(pct);
  const rafRef = useRef<number>(0);
  const fromPct = useRef(pct);
  const toPct = useRef(pct);
  const interpStart = useRef(Date.now());
  const INTERP_MS = 250;

  // When pct ticks (every ~200ms), set new interpolation target
  useEffect(() => {
    fromPct.current = smoothPct;
    toPct.current = pct;
    interpStart.current = Date.now();
  }, [pct]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const tick = () => {
      setPhase(p => (p + 0.05) % (Math.PI * 2));
      const elapsed = Date.now() - interpStart.current;
      const t = Math.min(elapsed / INTERP_MS, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setSmoothPct(fromPct.current + (toPct.current - fromPct.current) * ease);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const W = 500; const H = 36; const midY = H / 2;
  const amplitude = 9; const waves = 5;

  // Wavy progress (elapsed) grows from the left; the straight remaining segment shrinks
  // to match — same relationship as the ring version.
  const genWavyPath = (endPct: number) => {
    const endX = W * (Math.max(0, Math.min(100, endPct)) / 100);
    // Resolution scales with wave CYCLES actually drawn, not with endPct directly —
    // otherwise a flat minimum point count under-samples once enough cycles are
    // squeezed into it, rendering as jagged kinks instead of a smooth curve.
    const cyclesInPath = (endPct / 100) * waves;
    const pts = Math.max(8, Math.ceil(cyclesInPath * 24));
    const out: string[] = [];
    for (let i = 0; i <= pts; i++) {
      const x = (i / pts) * endX;
      const y = midY + Math.sin((x / W) * waves * Math.PI * 2 + phase) * amplitude;
      out.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return out.join(' ');
  };

  const genStraightPath = (fromPct: number, toPct: number) => {
    const startX = W * (Math.max(0, Math.min(100, fromPct)) / 100);
    const endX = W * (Math.max(0, Math.min(100, toPct)) / 100);
    return `M ${startX.toFixed(2)} ${midY} L ${endX.toFixed(2)} ${midY}`;
  };

  const strokeColor = isOvertime ? 'var(--pomo-overtime)' : mode === 'break' ? 'var(--pomo-break)' : 'var(--pomo-focus)';
  const gapPct = 0.8; // tiny visual seam between the two segments

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none" shapeRendering="geometricPrecision" overflow="visible">
      {/* Straight remaining (time left) — shrinks as the wavy progress grows */}
      {smoothPct < 100 - gapPct && (
        <path d={genStraightPath(smoothPct + gapPct, 100)} fill="none" stroke="var(--ink)"
          strokeWidth={3} strokeOpacity={0.12} strokeLinecap="round"
          vectorEffect="non-scaling-stroke" />
      )}
      {/* Wavy progress (elapsed) */}
      {smoothPct > 0 && (
        <path d={genWavyPath(smoothPct)} fill="none" stroke={strokeColor}
          strokeWidth={4} strokeLinecap="round"
          vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
};
