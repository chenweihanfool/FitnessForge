import assert from "node:assert/strict";
import { test } from "node:test";
import type { Exercise, WorkoutEntryWithExercise } from "../schema";
import { buildMuscleHistory, classifyProgress } from "./muscle-history";
import { computeStreak } from "./streak";

const NOW = new Date("2026-10-31T04:00:00Z"); // 週六，這週從 10/26 開始
const WEEK_MS = 7 * 86400000;

const bench: Exercise = {
  id: "bench", name: "臥推", unit: "次", weightFactor: 10, category: "力量", splitCategory: null, splitRatio: 0,
  muscleChest: 100, muscleBack: 0, muscleLegs: 0, muscleShoulders: 0, muscleArms: 0, muscleCore: 0,
  muscleGlutes: 0, muscleFullBody: 0, movementCoefficient: 1, intensityFactor: 1,
};

let seq = 0;
function entry(iso: string, sets: number): WorkoutEntryWithExercise {
  return {
    id: `e${seq++}`, exerciseId: bench.id, value: 10, sets, weightFactor: 10, setDetails: null, loadKg: null,
    baselineValue: 30, date: new Date(iso), notes: null, source: "manual", sourceDays: null, exercise: bench,
  };
}

/** 從上週往回，每週一筆，sets[0] 是最近一週 */
const weekly = (sets: number[]) =>
  sets.map((s, i) => entry(new Date(Date.parse("2026-10-20T04:00:00Z") - i * WEEK_MS).toISOString(), s));

test("達成率是組數除以各肌群維持量，沒練的週也列出來", () => {
  const h = buildMuscleHistory([entry("2026-10-06T04:00:00Z", 3), entry("2026-10-20T04:00:00Z", 6)], NOW);
  assert.deepEqual(h.weeks.map((w) => w.weekStart), ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  const chest = h.axes.findIndex((a) => a.name === "胸");
  assert.deepEqual(h.weeks.map((w) => w.values[chest]), [50, 0, 100, 0]);
  assert.equal(h.weeks[3].isCurrent, true);
});

test("進步判定比近 4 週與前 4 週，不含進行中的週", () => {
  const h = buildMuscleHistory([...weekly([9, 9, 9, 9, 3, 3, 3, 3]), entry("2026-10-27T04:00:00Z", 30)], NOW);
  const chest = h.progress.find((p) => p.name === "胸")!;
  assert.equal(chest.recentAvg, 150);
  assert.equal(chest.prevAvg, 50);
  assert.equal(chest.status, "up");
  assert.equal(chest.spark.length, 8);
});

test("歷史不足 8 週時標示資料不足", () => {
  const h = buildMuscleHistory(weekly([6, 6, 6]), NOW);
  assert.equal(h.progress.find((p) => p.name === "胸")!.status, "insufficient");
});

test("進步門檻是 ±15%，前期是 0 時看有沒有練", () => {
  assert.equal(classifyProgress(115, 100), "up");
  assert.equal(classifyProgress(114, 100), "flat");
  assert.equal(classifyProgress(85, 100), "down");
  assert.equal(classifyProgress(10, 0), "up");
  assert.equal(classifyProgress(0, 0), "flat");
});

test("區間比較只列資料夠的區間", () => {
  const short = buildMuscleHistory(weekly(Array(5).fill(6)), NOW);
  assert.deepEqual(short.periods.map((p) => p.key), ["now"]);
  const long = buildMuscleHistory(weekly(Array(60).fill(6)), NOW);
  assert.deepEqual(long.periods.map((p) => p.key), ["now", "quarter", "year"]);
});

test("未來日期的記錄不算", () => {
  const h = buildMuscleHistory([entry("2026-11-05T04:00:00Z", 6)], NOW);
  assert.equal(h.weeks.length, 1);
  assert.equal(h.weeks[0].trainingDays, 0);
});

test("連續達標：進行中的週沒達標不算中斷", () => {
  const w = (trainingDays: number, inProgress = false) => ({ trainingDays, inProgress });
  assert.deepEqual(computeStreak([w(3), w(4), w(1), w(3), w(5), w(1, true)]), { current: 2, best: 2, target: 3 });
  assert.equal(computeStreak([w(3), w(3), w(3, true)]).current, 3);
  assert.equal(computeStreak([w(3), w(0)]).current, 0);
  assert.equal(computeStreak([]).best, 0);
});
