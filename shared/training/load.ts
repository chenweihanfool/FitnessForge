// 「負重／強度」的單一定義處。
//
// 力量項目的 weightFactor = 動作強度（運動項目設定的指數，徒手動作是體重當量）+ 外加負重（kg）。
// 它是計分用的「強度指標」，不是純粹的公斤數，所以不同動作之間的數值本來就不必一致；
// 追蹤歷史進步時看的是「同一個動作的合計強度」怎麼變。歷史資料不用搬移，直接讀 weightFactor。
// 新記錄另外把外加負重（真正掛上去的公斤數）存在 loadKg，方便預填與顯示。
//
// 其他類別（有氧/活動量/柔軟度…）的 weightFactor 只是計分係數、不是公斤數，
// 負重改由 loadKg 記錄（例如跑步機負重背心），只用於追蹤，不影響基準值。
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

/** 追蹤用的「合計強度」（力量）或「負重 kg」（其他） */
export function effectiveLoad(entry: LoadEntryFields, ex: LoadExerciseFields): number | null {
  if (isStrengthExercise(ex)) return entry.weightFactor ?? ex.weightFactor ?? null;
  return entry.loadKg != null && entry.loadKg > 0 ? entry.loadKg : null;
}

/** 力量項目這筆記錄的外加負重（kg）；舊記錄與逐組樣板沒有這個值 */
export function externalLoad(entry: LoadEntryFields, ex: Pick<LoadExerciseFields, "category">): number | null {
  return isStrengthExercise(ex) && entry.loadKg != null && entry.loadKg > 0 ? entry.loadKg : null;
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
