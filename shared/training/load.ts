// 「負重」的單一定義處。
//
// 力量項目的 weightFactor 本來就同時是「計分係數」也是「這次實際使用的重量（公斤）」
// （徒手動作 = 體重公斤當量 + 附加負重，見新增記錄對話框），所以歷史資料不用搬移，
// 力量項目的負重直接讀 weightFactor。其他類別（有氧/活動量/柔軟度…）的 weightFactor
// 只是計分係數、不是公斤數，負重改由獨立欄位 loadKg 記錄（例如跑步機負重背心），
// 只用於追蹤，不影響基準值。
export interface LoadEntryFields {
  loadKg?: number | null;
  weightFactor: number | null;
}
export interface LoadExerciseFields {
  category: string | null;
  weightFactor: number;
}

export function isStrengthExercise(ex: Pick<LoadExerciseFields, "category">): boolean {
  return ex.category === "力量";
}

export function effectiveLoad(entry: LoadEntryFields, ex: LoadExerciseFields): number | null {
  if (entry.loadKg != null && entry.loadKg > 0) return entry.loadKg;
  if (isStrengthExercise(ex)) return entry.weightFactor ?? ex.weightFactor ?? null;
  return null;
}

/** Epley 公式：1RM ≈ 重量 × (1 + 次數/30)。次數太高時失真，上限 20 下。 */
export function estimateOneRepMax(load: number, reps: number): number | null {
  if (!(load > 0) || !(reps > 0) || reps > 20) return null;
  return reps === 1 ? load : load * (1 + reps / 30);
}

/** 單位是「次/下」這類以次數計的才適合算 1RM（分鐘、秒、公里不適用） */
export function isRepUnit(unit: string): boolean {
  return /次|下|rep/i.test(unit);
}
