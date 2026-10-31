// 逐組樣板（遞增 / 自訂）的純計算。記錄本身只存平均值（次數 × 組數 @ 平均重量），
// 但「總訓練量」要保持跟逐組實際相加一致，所以用「次數加權平均重量」換算；
// 逐組明細另外存在 setDetails，下次才能原樣還原成同樣的遞增方式。

export interface SetRow {
  weight: number;
  reps: number;
}
export type SetRowInput = { weight: number | ""; reps: number | "" };

export function validRows(rows: SetRowInput[]): SetRow[] {
  return rows.filter(
    (s): s is SetRow => typeof s.weight === "number" && typeof s.reps === "number" && s.weight > 0 && s.reps > 0,
  );
}

/** 逐組 → 單列（value/sets/weightFactor）：次數加權平均重量，總容量（Σ重量×次數）不變 */
export function computeCustomSets(rows: SetRowInput[]) {
  const valid = validRows(rows);
  if (valid.length === 0) return null;
  const totalVolume = valid.reduce((sum, s) => sum + s.weight * s.reps, 0);
  const avgReps = valid.reduce((sum, s) => sum + s.reps, 0) / valid.length;
  const avgWeight = totalVolume / (avgReps * valid.length);
  return { count: valid.length, totalVolume, avgReps, avgWeight };
}

/**
 * 遞增樣板：依「起始重量／每組遞增／總組數／每組次數／每組次數遞減」產生每組明細
 * （次數遞減 0 = 每組次數相同）。次數遞減到 1 以下夾在 1。
 */
export function computeProgressiveSets(
  startWeight: number,
  weightIncrement: number,
  numSets: number,
  baseReps: number,
  repsDecrement: number,
): SetRow[] {
  const sets: SetRow[] = [];
  for (let i = 0; i < numSets; i++) {
    sets.push({ weight: startWeight + i * weightIncrement, reps: Math.max(1, baseReps - i * repsDecrement) });
  }
  return sets;
}

export interface ProgressionParams {
  startWeight: number;
  increment: number;
  numSets: number;
  repsPerSet: number;
  repsDecrement: number;
}

const EPS = 1e-6;

/** 看逐組明細是不是「等差遞增」：重量每組增加固定值、次數每組減少固定值（含 0）。是的話回傳樣板引數。 */
export function detectProgression(rows: SetRow[]): ProgressionParams | null {
  if (rows.length < 2) return null;
  const dw = rows[1].weight - rows[0].weight;
  const dr = rows[0].reps - rows[1].reps; // 每組減少幾下
  if (dr < 0 || rows[0].reps - dr * (rows.length - 1) < 1) return null;
  for (let i = 1; i < rows.length; i++) {
    if (Math.abs(rows[i].weight - rows[i - 1].weight - dw) > EPS) return null;
    if (Math.abs(rows[i - 1].reps - rows[i].reps - dr) > EPS) return null;
  }
  return { startWeight: rows[0].weight, increment: dw, numSets: rows.length, repsPerSet: rows[0].reps, repsDecrement: dr };
}
