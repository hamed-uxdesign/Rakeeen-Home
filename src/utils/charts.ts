// Round Y-axis ticks — picks a "nice" step (1/2/5 × a power of 10) instead of
// dividing the target by a fixed count, so labels land on whole numbers like
// 2, 4, 6, 8, 10, 12 instead of 2.4, 4.8, 7.2, 9.6...
export function niceTicks(target: number, count: number = 6): number[] {
  if (target <= 0) return [0];
  const rawStep = target / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceNormalized * magnitude;
  const ticks: number[] = [];
  for (let t = 0; t <= target + step * 0.5; t += step) ticks.push(Math.round(t * 100) / 100);
  return ticks;
}
